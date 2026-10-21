-- Cota de consultas SERPRO incluída em cada plano, por id_sistema, renovada por período
-- (hoje só "mensal" na prática, igual planos.periodicidade -- sem FK/enum pro id_sistema,
-- mesmo padrão livre de custos_consultas_serpro.id_sistema e consultas_serpro.id_sistema).
-- Dentro dessa cota o sync não debita crédito (ver sincronizar-das-empresa.usecase.ts);
-- além dela, debita normalmente do pool fungível de creditos_saldo.
create table plano_consultas_incluidas (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos(id) on delete cascade,
  id_sistema text not null,
  quantidade_por_periodo integer not null check (quantidade_por_periodo > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (plano_id, id_sistema)
);

create trigger trg_plano_consultas_incluidas_atualizado_em
  before update on plano_consultas_incluidas
  for each row execute function set_atualizado_em();

comment on table plano_consultas_incluidas is 'Quantas consultas de um id_sistema do SERPRO (ex: PGDASD) um plano inclui "de graça" por período -- acima disso, consome creditos_saldo normalmente.';

alter table plano_consultas_incluidas enable row level security;

-- Mesmo padrão de planos: select liberado a qualquer autenticado (catálogo público,
-- cliente precisa ver o que o plano dele inclui), escrita só plataforma.
create policy plano_consultas_incluidas_select on plano_consultas_incluidas for select to authenticated using (true);
create policy plano_consultas_incluidas_insert on plano_consultas_incluidas for insert to authenticated with check (eh_plataforma());
create policy plano_consultas_incluidas_update on plano_consultas_incluidas for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy plano_consultas_incluidas_delete on plano_consultas_incluidas for delete to authenticated using (eh_plataforma());
