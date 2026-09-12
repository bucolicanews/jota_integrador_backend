-- Bug real encontrado testando o Balanço Patrimonial (Fase 5): quando p_data_inicio é
-- null ("desde sempre", usado só pelo Balanço), a condição do saldo_ate era
-- `(p_data_inicio is null or lc.data_competencia < p_data_inicio)` -- que quando
-- p_data_inicio é null vira incondicionalmente VERDADEIRA (o `or` nunca chega a avaliar
-- a segunda parte), então saldo_ate somava TODOS os lançamentos até hoje, sem filtro
-- nenhum. E o `mov` (lateral seguinte) TAMBÉM soma tudo até p_data_fim sem limite
-- inferior nesse caso. Resultado: saldo_final = saldo_ate (= tudo) + mov (= tudo de
-- novo) -- cada lançamento contado DUAS VEZES. Sintoma real observado: Balanço
-- Patrimonial mostrava Receita de Serviços com saldo 1000 quando o Razão/Balancete (que
-- usam p_data_inicio real) mostravam corretamente 500 pro mesmo período -- exatamente o
-- dobro.
--
-- Correção: quando p_data_inicio é null, não existe "antes do período" (o período é
-- "desde sempre"), então saldo_ate deve ser 0, não "tudo". Trocado o `or` por `and
-- p_data_inicio is not null` -- a condição só pode ser verdadeira quando p_data_inicio
-- foi de fato informado.

create or replace function relatorio_saldos_periodo(
  p_empresa_id uuid,
  p_data_inicio date default null,
  p_data_fim date default current_date
)
returns table(conta_id uuid, saldo_inicial numeric, total_debito numeric, total_credito numeric, saldo_final numeric)
language sql
stable
as $$
  with recursive folhas as (
    select
      pc.id as conta_id,
      coalesce(saldo_ate.saldo, 0) as saldo_inicial,
      coalesce(mov.debito, 0) as total_debito,
      coalesce(mov.credito, 0) as total_credito,
      coalesce(saldo_ate.saldo, 0) + (
        case when pc.grupo in ('ativo', 'custo', 'despesa')
          then coalesce(mov.debito, 0) - coalesce(mov.credito, 0)
          else coalesce(mov.credito, 0) - coalesce(mov.debito, 0)
        end
      ) as saldo_final
    from plano_contas pc
    left join lateral (
      select case when pc.grupo in ('ativo', 'custo', 'despesa')
          then sum(case when lp.tipo = 'debito' then lp.valor else -lp.valor end)
          else sum(case when lp.tipo = 'credito' then lp.valor else -lp.valor end)
        end as saldo
      from lancamentos_partidas lp
      join lancamentos_contabeis lc on lc.id = lp.lancamento_id
      where lp.conta_id = pc.id
        and p_data_inicio is not null
        and lc.data_competencia < p_data_inicio
    ) saldo_ate on true
    left join lateral (
      select
        sum(case when lp.tipo = 'debito' then lp.valor else 0 end) as debito,
        sum(case when lp.tipo = 'credito' then lp.valor else 0 end) as credito
      from lancamentos_partidas lp
      join lancamentos_contabeis lc on lc.id = lp.lancamento_id
      where lp.conta_id = pc.id
        and (p_data_inicio is null or lc.data_competencia >= p_data_inicio)
        and lc.data_competencia <= p_data_fim
    ) mov on true
    where pc.empresa_id = p_empresa_id and pc.sintetica = false and pc.ativa = true
  ),
  ancestrais as (
    select f.conta_id as folha_id, f.saldo_inicial, f.total_debito, f.total_credito, f.saldo_final,
           pc.id as ancestral_id
    from folhas f
    join plano_contas pc on pc.id = f.conta_id
    union all
    select a.folha_id, a.saldo_inicial, a.total_debito, a.total_credito, a.saldo_final,
           pc.conta_pai_id
    from ancestrais a
    join plano_contas pc on pc.id = a.ancestral_id
    where pc.conta_pai_id is not null
  )
  select
    ancestral_id as conta_id,
    sum(saldo_inicial) as saldo_inicial,
    sum(total_debito) as total_debito,
    sum(total_credito) as total_credito,
    sum(saldo_final) as saldo_final
  from ancestrais
  group by ancestral_id
$$;

comment on function relatorio_saldos_periodo(uuid, date, date) is 'Saldo inicial/débito/crédito/saldo final por conta (analítica com valor real, sintética com somatório recursivo dos descendentes) dentro de um período. p_data_inicio null = "desde sempre" (saldo inicial = 0, útil pro Balanço Patrimonial).';
