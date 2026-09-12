-- Fase 5 do port do jotaCaixa: Relatórios (Razão, Balancete, Balanço Patrimonial, DRE,
-- Fluxo de Caixa). Só leitura/agregação -- nenhuma tabela nova, nenhuma regra de negócio
-- nova, só duas funções SQL que somam `lancamentos_partidas` já existente.
--
-- Diferença estrutural importante em relação ao jotaCaixa: lá o "saldo inicial" de uma
-- conta vinha de uma tabela cacheada (`saldo_contas.saldo_inicial`) e a agregação de
-- contas sintéticas era por prefixo de string do código (`Conta.startsWith(prefixo)`).
-- Aqui não existe saldo cacheado -- "saldo inicial de um período" é só o resultado de
-- somar tudo que aconteceu ANTES da data de início (mesmo princípio de
-- `saldo_conta_contabil`, nunca cacheado) -- e a árvore de contas é uma FK real
-- (`conta_pai_id`), não convenção de string, então a agregação de sintéticas usa uma CTE
-- recursiva de verdade em vez de prefix-matching.

-- ============================================================
-- relatorio_saldos_periodo: saldo inicial / débito / crédito / saldo final de TODA
-- conta (analítica com valor real + sintética com o somatório dos descendentes) num
-- período. Serve de base pra Balancete, Balanço Patrimonial (chamando com
-- p_data_inicio = null -- "desde sempre") e DRE (usando total_debito/total_credito,
-- que é exatamente o movimento do período, não o saldo acumulado).
-- ============================================================

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
        and (p_data_inicio is null or lc.data_competencia < p_data_inicio)
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
  -- Caminho de cada folha até a raiz (inclui a própria folha no nível 0), pra somar o
  -- valor dela em si mesma e em todo ancestral sintético.
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

comment on function relatorio_saldos_periodo(uuid, date, date) is 'Saldo inicial/débito/crédito/saldo final por conta (analítica com valor real, sintética com somatório recursivo dos descendentes) dentro de um período. p_data_inicio null = "desde sempre" (saldo inicial vira 0, útil pro Balanço Patrimonial).';

-- ============================================================
-- movimentos_periodo_contas: lista plana de movimentos (uma linha por partida) num
-- período, opcionalmente restrita a uma conta -- base do Livro Razão e do Fluxo de
-- Caixa (que filtra pelas contas conta_caixa_banco=true no lado da aplicação).
-- ============================================================

create or replace function movimentos_periodo_contas(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_conta_id uuid default null
)
returns table(
  conta_id uuid,
  lancamento_id uuid,
  data_competencia date,
  historico text,
  origem text,
  tipo text,
  valor numeric
)
language sql
stable
as $$
  select lp.conta_id, lp.lancamento_id, lc.data_competencia, lc.historico, lc.origem, lp.tipo, lp.valor
  from lancamentos_partidas lp
  join lancamentos_contabeis lc on lc.id = lp.lancamento_id
  join plano_contas pc on pc.id = lp.conta_id
  where pc.empresa_id = p_empresa_id
    and lc.data_competencia between p_data_inicio and p_data_fim
    and (p_conta_id is null or lp.conta_id = p_conta_id)
  order by lc.data_competencia asc, lc.criado_em asc
$$;

comment on function movimentos_periodo_contas(uuid, date, date, uuid) is 'Lista de movimentos (uma linha por partida de débito/crédito) dentro de um período, opcionalmente filtrada a uma conta. Base do Livro Razão e do Fluxo de Caixa.';

insert into permissoes (recurso, acao) values ('relatorios', 'visualizar')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'relatorios'
on conflict do nothing;
