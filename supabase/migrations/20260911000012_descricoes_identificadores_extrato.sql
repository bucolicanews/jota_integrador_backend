-- Picklists de apoio pro Lançamento de Extrato Manual (`descricao_extrato`/`identificacao_extrato`
-- no jotaCaixa) -- sugestões de preenchimento rápido, mesmo princípio de `historicos`
-- (texto livre, sem FK, real DELETE permitido porque nada referencia essas linhas).
-- Diferente do jotaCaixa: sem `status`/`ordem` (ativar/desativar, arrastar pra reordenar)
-- nesta v1 -- é só uma lista simples de sugestões, não um catálogo curado com posição fixa.

create table descricoes_extrato (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  descricao text not null,
  criado_em timestamptz not null default now()
);
create index idx_descricoes_extrato_empresa on descricoes_extrato(empresa_id);

create table identificadores_extrato (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  descricao text not null,
  criado_em timestamptz not null default now()
);
create index idx_identificadores_extrato_empresa on identificadores_extrato(empresa_id);

alter table descricoes_extrato enable row level security;
alter table identificadores_extrato enable row level security;

create policy descricoes_extrato_select on descricoes_extrato for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy descricoes_extrato_insert on descricoes_extrato for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy descricoes_extrato_update on descricoes_extrato for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy descricoes_extrato_delete on descricoes_extrato for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy identificadores_extrato_select on identificadores_extrato for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy identificadores_extrato_insert on identificadores_extrato for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy identificadores_extrato_update on identificadores_extrato for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy identificadores_extrato_delete on identificadores_extrato for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

insert into permissoes (recurso, acao) values
  ('descricoes_extrato', 'visualizar'), ('descricoes_extrato', 'criar'), ('descricoes_extrato', 'editar'), ('descricoes_extrato', 'excluir'),
  ('identificadores_extrato', 'visualizar'), ('identificadores_extrato', 'criar'), ('identificadores_extrato', 'editar'), ('identificadores_extrato', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso in ('descricoes_extrato', 'identificadores_extrato')
on conflict do nothing;
