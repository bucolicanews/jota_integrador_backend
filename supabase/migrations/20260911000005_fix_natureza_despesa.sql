-- Bug real encontrado testando Contas a Pagar (Fase 2): `saldo_conta_contabil` tratava
-- contas do grupo 'despesa' como natureza CREDORA (mesmo bucket de passivo/receita) --
-- errado, despesa é devedora (mesmo lado de ativo/custo) em partida dobrada padrão.
-- Sintoma: saldo de uma conta de despesa aparecia negativo mesmo com débitos reais
-- (ex: R$200 de despesa lançada mostrava saldo -200 em vez de 200). Mesmo bug existia
-- em `naturezaDoGrupo()` (src/plano-de-contas/dominio/plano-conta.ts), já corrigido no
-- código -- esta migration corrige o espelho em SQL.

create or replace function saldo_conta_contabil(p_conta_id uuid, p_ate_data date default null)
returns numeric
language sql
stable
as $$
  select coalesce(
    (
      select
        case
          when pc.grupo in ('ativo', 'custo', 'despesa')
            then sum(case when lp.tipo = 'debito' then lp.valor else -lp.valor end)
          else
            sum(case when lp.tipo = 'credito' then lp.valor else -lp.valor end)
        end
      from plano_contas pc
      join lancamentos_partidas lp on lp.conta_id = pc.id
      join lancamentos_contabeis lc on lc.id = lp.lancamento_id
      where pc.id = p_conta_id
        and (p_ate_data is null or lc.data_competencia <= p_ate_data)
      group by pc.grupo
    ),
    0
  )
$$;

comment on function saldo_conta_contabil(uuid, date) is 'Saldo assinado (positivo = a favor da natureza da conta) somando todas as partidas até a data informada (ou até hoje, se omitida). Sempre calculado na hora, nunca cacheado. Devedoras: ativo, custo, despesa.';
