-- Cadastro de Bancos/Caixas -- resolve o gap encontrado cruzando a lista de rotas de
-- produção do jotaCaixa (`/bancos`) com o que já existe aqui. jotaCaixa tem `saldo_contas`
-- como registro PRÓPRIO com `saldo_atual` CACHEADO (incrementado/decrementado a cada
-- lançamento) -- exatamente o padrão que este projeto já rejeitou deliberadamente ao
-- construir `saldo_conta_contabil()` (ver migration 20260909000006_saldo_conta_contabil.sql
-- e Fase 5/Relatórios): saldo sempre somado ao vivo, nunca cacheado, pra nunca divergir.
--
-- Decisão confirmada com o usuário: `bancos` é um cadastro LEVE por cima de uma conta já
-- existente no Plano de Contas (marcada `conta_caixa_banco = true`) -- só dá um nome
-- amigável ("Banco Cora", "Caixa Loja 1") pra uma conta que já existe. Conciliação/Contas a
-- Pagar/Contas a Receber continuam referenciando `plano_contas.id` diretamente, sem
-- nenhuma mudança -- `bancos` não substitui nada, só organiza a exibição. Saldo sempre
-- calculado on-the-fly via `saldo_conta_contabil()` já existente (nunca um campo
-- `saldo_inicial`/`saldo_atual` aqui -- decisão explícita do usuário, evita 2ª fonte de
-- verdade de saldo fora do livro-razão).

create table bancos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  nome text not null,
  conta_contabil_id uuid not null references plano_contas(id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Um banco por conta contábil -- evita dois registros de exibição apontando pro mesmo
-- saldo (confuso: qual dos dois é "o" saldo daquela conta?).
create unique index idx_bancos_empresa_conta on bancos(empresa_id, conta_contabil_id);
create index idx_bancos_empresa on bancos(empresa_id);

create trigger trg_bancos_atualizado_em before update on bancos
  for each row execute function set_atualizado_em();

comment on table bancos is 'Nome amigável por cima de uma conta do Plano de Contas marcada conta_caixa_banco=true. Nunca guarda saldo -- sempre calculado ao vivo via saldo_conta_contabil(). Nunca excluído de verdade, só desativado (ativo=false).';

alter table bancos enable row level security;

create policy bancos_select on bancos for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy bancos_insert on bancos for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy bancos_update on bancos for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
-- Nunca delete de verdade -- desativar (ativo=false), mesmo princípio de clientes/fornecedores.
create policy bancos_delete on bancos for delete to authenticated using (false);

insert into permissoes (recurso, acao) values
  ('bancos', 'visualizar'), ('bancos', 'criar'), ('bancos', 'editar'), ('bancos', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'bancos'
on conflict do nothing;
