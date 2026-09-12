-- Fase 3 do port do jotaCaixa: Clientes e Fornecedores. Minerado de Clientes.tsx +
-- src/types/cliente.ts -- mas a maior parte daquele arquivo (promover cliente pra
-- "cliente do sistema" com login Auth, convites, planos trial) é específica do
-- jotaCaixa ser ele mesmo um SaaS multi-tenant (Admin=firma vende acesso pros próprios
-- Clientes) -- não se aplica aqui, já coberto de outra forma (assinaturas/onboarding
-- próprios do jota_integrador). O que interessa é só o registro de contato/documento
-- (campos de `Cliente` em `src/types/cliente.ts`), usado como cadastro de apoio pra
-- Contas a Receber (cliente) e Contas a Pagar (fornecedor) -- fornecedor nunca existiu
-- como tabela no jotaCaixa (sempre texto livre), construído aqui por simetria, a
-- pedido explícito do usuário.

create table clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  nome text not null,
  razao_social text,
  documento text,
  email text,
  telefone text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_clientes_empresa on clientes(empresa_id);

create trigger trg_clientes_atualizado_em before update on clientes
  for each row execute function set_atualizado_em();

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  nome text not null,
  razao_social text,
  documento text,
  email text,
  telefone text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_fornecedores_empresa on fornecedores(empresa_id);

create trigger trg_fornecedores_atualizado_em before update on fornecedores
  for each row execute function set_atualizado_em();

alter table clientes enable row level security;
alter table fornecedores enable row level security;

create policy clientes_select on clientes for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy clientes_insert on clientes for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy clientes_update on clientes for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
-- Nunca delete de verdade -- desativar (ativo=false), mesmo princípio de plano_contas.
-- Evita quebrar contas_receber.cliente_id que já aponta pra esse registro.
create policy clientes_delete on clientes for delete to authenticated using (false);

create policy fornecedores_select on fornecedores for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy fornecedores_insert on fornecedores for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy fornecedores_update on fornecedores for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy fornecedores_delete on fornecedores for delete to authenticated using (false);

comment on table clientes is 'Cadastro de clientes (contraparte de Contas a Receber) por empresa. Nunca excluído, só desativado.';
comment on table fornecedores is 'Cadastro de fornecedores (contraparte de Contas a Pagar) por empresa. Nunca excluído, só desativado.';

-- ============================================================
-- FK opcional em contas_receber/contas_pagar -- o texto livre (cliente_nome/
-- fornecedor) continua existindo e é a fonte de verdade exibida (congela o nome no
-- momento da transação, prática normal de faturamento -- editar o cadastro depois não
-- deve alterar contas já emitidas). O id, quando presente, só linka pro cadastro
-- pra reaproveitar dados/relatório por contraparte.
-- ============================================================

alter table contas_receber add column if not exists cliente_id uuid references clientes(id);
alter table contas_pagar add column if not exists fornecedor_id uuid references fornecedores(id);

create index idx_contas_receber_cliente on contas_receber(cliente_id);
create index idx_contas_pagar_fornecedor on contas_pagar(fornecedor_id);

-- ============================================================
-- Catálogo de permissões
-- ============================================================

insert into permissoes (recurso, acao) values
  ('clientes', 'visualizar'), ('clientes', 'criar'), ('clientes', 'editar'), ('clientes', 'excluir'),
  ('fornecedores', 'visualizar'), ('fornecedores', 'criar'), ('fornecedores', 'editar'), ('fornecedores', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso in ('clientes', 'fornecedores')
on conflict do nothing;
