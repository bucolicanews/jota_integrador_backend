-- Créditos SERPRO deixam de ser um pool único por CONTADOR e passam a ser por
-- EMPRESA-CLIENTE -- cada empresa precisa da própria assinatura ativa pra consultar o
-- SERPRO. Pagamento deixa de ser Stripe (contador paga a Jota) e passa a ser PIX com
-- split PagBank (empresa paga, split entre plataforma e contador) -- mesmo mecanismo já
-- usado por licencas_modulo/pagamentos_ativacao_licenca. Projeto sem produção/deploy
-- ainda (confirmado em sessão anterior) -- seguro truncar em vez de migrar dado real.
truncate table faturas, assinaturas, creditos_movimentos, creditos_saldo cascade;

drop policy if exists assinaturas_select on assinaturas;
drop policy if exists assinaturas_insert on assinaturas;
drop policy if exists assinaturas_update on assinaturas;
drop policy if exists assinaturas_delete on assinaturas;

alter table assinaturas
  drop column stripe_subscription_id,
  drop column renovacao_automatica,
  add column empresa_id uuid references empresas(id),
  add column plano_revenda_id uuid references planos_revenda_creditos(id);

alter table assinaturas alter column empresa_id set not null;

alter table assinaturas drop constraint assinaturas_status_check;
alter table assinaturas add constraint assinaturas_status_check check (status in ('ativa', 'bloqueada', 'cancelada'));

-- Só 1 assinatura não-cancelada por empresa -- evita ambiguidade sobre qual plano vale
-- pro gate de acesso ao SERPRO.
create unique index idx_assinaturas_empresa_nao_cancelada on assinaturas(empresa_id) where status <> 'cancelada';

create index idx_assinaturas_empresa_id on assinaturas(empresa_id);

create policy assinaturas_select on assinaturas for select to authenticated
  using (eh_plataforma() or pode_acessar_contador(contador_id) or pode_acessar_empresa(empresa_id));
create policy assinaturas_insert on assinaturas for insert to authenticated
  with check (eh_plataforma() or contador_id = auth_contador_id());
create policy assinaturas_update on assinaturas for update to authenticated
  using (eh_plataforma() or contador_id = auth_contador_id())
  with check (eh_plataforma() or contador_id = auth_contador_id());
create policy assinaturas_delete on assinaturas for delete to authenticated using (false);

-- creditos_saldo: chave passa de contador_id pra empresa_id.
drop policy if exists creditos_saldo_select on creditos_saldo;
drop policy if exists creditos_saldo_insert on creditos_saldo;
drop policy if exists creditos_saldo_update on creditos_saldo;
drop policy if exists creditos_saldo_delete on creditos_saldo;
drop table creditos_saldo;

create table creditos_saldo (
  empresa_id uuid primary key references empresas(id),
  saldo_atual integer not null default 0 check (saldo_atual >= 0),
  atualizado_em timestamptz not null default now()
);

comment on table creditos_saldo is 'Cache mutável do saldo corrente da empresa-cliente. Fonte da verdade auditável é creditos_movimentos.';

create trigger trg_set_atualizado_em before update on creditos_saldo
  for each row execute function set_atualizado_em();

alter table creditos_saldo enable row level security;

create policy creditos_saldo_select on creditos_saldo for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy creditos_saldo_insert on creditos_saldo for insert to authenticated with check (
  eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id)
);
create policy creditos_saldo_update on creditos_saldo for update to authenticated using (
  eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id)
) with check (
  eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id)
);
create policy creditos_saldo_delete on creditos_saldo for delete to authenticated using (false);

-- creditos_movimentos: contador continua podendo ver/lançar pras próprias empresas, não
-- só a plataforma -- ele passa a gerenciar os créditos de cada cliente diretamente.
drop policy if exists creditos_movimentos_select on creditos_movimentos;
drop policy if exists creditos_movimentos_insert on creditos_movimentos;

create policy creditos_movimentos_select on creditos_movimentos for select to authenticated
  using (pode_acessar_contador(contador_id) or pode_acessar_empresa(empresa_id));
create policy creditos_movimentos_insert on creditos_movimentos for insert to authenticated with check (
  eh_plataforma() or auth_contador_id() = contador_id
);
