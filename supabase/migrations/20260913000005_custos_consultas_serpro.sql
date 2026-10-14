-- Custo interno em R$ por tipo de consulta ao SERPRO (id_sistema) -- SÓ pra o admin
-- acompanhar margem/custo operacional real da Jota. Nunca exposto ao contador (mantém a
-- decisão de produto já documentada em creditos/dominio/credito.ts: "operações fiscais
-- nunca detalhadas granularmente pro cliente final" -- aqui é o oposto, uso interno).
create table custos_consultas_serpro (
  id_sistema text primary key,
  custo_reais numeric(10, 2) not null check (custo_reais >= 0),
  atualizado_em timestamptz not null default now()
);

create trigger trg_custos_consultas_serpro_atualizado_em
  before update on custos_consultas_serpro
  for each row execute function set_atualizado_em();

comment on table custos_consultas_serpro is 'Custo interno em R$ por chamada bem-sucedida a um id_sistema do SERPRO (ex: CCMEI, CAIXAPOSTAL) -- mesma chave livre de consultas_serpro.id_sistema, sem FK/enum (novo sistema integrado não exige migration aqui). Config de catálogo que muda no tempo -- por isso tabela própria, não coluna em consultas_serpro (que é log imutável append-only).';

alter table custos_consultas_serpro enable row level security;

-- Tabela de uso 100% interno do admin -- diferente de pacotes_modulos/planos, não há
-- motivo de negócio pra qualquer contador/empresa ler isso, nem select.
create policy custos_consultas_serpro_select on custos_consultas_serpro for select to authenticated using (eh_plataforma());
create policy custos_consultas_serpro_insert on custos_consultas_serpro for insert to authenticated with check (eh_plataforma());
create policy custos_consultas_serpro_update on custos_consultas_serpro for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy custos_consultas_serpro_delete on custos_consultas_serpro for delete to authenticated using (eh_plataforma());

-- Agregação de consultas_serpro (log imutável) cruzada com o custo configurado -- security
-- definer pelo mesmo motivo de empresa_tem_modulo(): agrega sem expor as linhas cruas de
-- consultas_serpro via RLS normal pra quem chama a função; a checagem de papel de quem
-- PODE chamar essa função acontece no controller NestJS (SUPER_ADMIN/ADMIN_FINANCEIRO).
create or replace function relatorio_consultas_serpro(
  p_contador_id uuid default null,
  p_empresa_id uuid default null,
  p_id_sistema text default null,
  p_data_inicio date default null,
  p_data_fim date default null
)
returns table(
  id_sistema text,
  contador_id uuid,
  empresa_id uuid,
  total_consultas bigint,
  total_sucesso bigint,
  custo_total_reais numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cs.id_sistema,
    cs.contador_id,
    cs.empresa_id,
    count(*) as total_consultas,
    count(*) filter (where cs.sucesso) as total_sucesso,
    coalesce((select c.custo_reais from custos_consultas_serpro c where c.id_sistema = cs.id_sistema), 0)
      * count(*) filter (where cs.sucesso) as custo_total_reais
  from consultas_serpro cs
  where (p_contador_id is null or cs.contador_id = p_contador_id)
    and (p_empresa_id is null or cs.empresa_id = p_empresa_id)
    and (p_id_sistema is null or cs.id_sistema = p_id_sistema)
    and (p_data_inicio is null or cs.criado_em >= p_data_inicio)
    and (p_data_fim is null or cs.criado_em < p_data_fim + interval '1 day')
  group by cs.id_sistema, cs.contador_id, cs.empresa_id
$$;

comment on function relatorio_consultas_serpro is 'Agrega consultas_serpro por id_sistema/contador/empresa, multiplicando sucessos pelo custo configurado em custos_consultas_serpro. Chamada só pelo controller admin-only de custos-serpro.';
