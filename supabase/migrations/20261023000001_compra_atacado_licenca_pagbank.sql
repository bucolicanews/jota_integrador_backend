-- Compra de pacote de licença no ATACADO deixa de ser assinatura recorrente via Stripe
-- (PagBank não tem primitivo nativo de recorrência) e passa a ser compra avulsa única,
-- mesmo espírito de pacotes_creditos_avulsos.comprarDireto -- SEM split, venda direta
-- Jota->contador. "Renovar" vira comprar de novo quando precisar, nunca cobrança
-- automática. Ver ProcessarWebhookStripeLicencaUseCase (removido) pro histórico do
-- fluxo antigo.
create table pagamentos_compra_atacado_licenca (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  pacote_id uuid not null references pacotes_modulos(id),
  valor_total numeric(12, 2) not null,
  metodo text not null check (metodo in ('pix', 'cartao')),
  pagbank_order_id text,
  pagbank_charge_id text,
  pix_code text,
  pix_qr_url text,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pago_em timestamptz
);

comment on column pagamentos_compra_atacado_licenca.valor_total is 'Congelado no momento da ordem a partir de pacotes_modulos.preco -- não recalcula se o preço do pacote mudar depois.';

-- Só 1 tentativa pendente por contador ao mesmo tempo -- evita 2 ordens PagBank
-- concorrentes pra ele.
create unique index idx_pagamentos_compra_atacado_pendente
  on pagamentos_compra_atacado_licenca(contador_id) where status = 'pendente';

create index idx_pagamentos_compra_atacado_pagbank_order on pagamentos_compra_atacado_licenca(pagbank_order_id);

create trigger trg_pagamentos_compra_atacado_atualizado_em before update on pagamentos_compra_atacado_licenca
  for each row execute function set_atualizado_em();

alter table pagamentos_compra_atacado_licenca enable row level security;

create policy pagamentos_compra_atacado_select on pagamentos_compra_atacado_licenca for select to authenticated
  using (eh_plataforma() or pode_acessar_contador(contador_id));
create policy pagamentos_compra_atacado_insert on pagamentos_compra_atacado_licenca for insert to authenticated
  with check (eh_plataforma() or contador_id = auth_contador_id());
-- Só backend (service role, via webhook) muda status.
create policy pagamentos_compra_atacado_update on pagamentos_compra_atacado_licenca for update to authenticated
  using (eh_plataforma()) with check (eh_plataforma());
create policy pagamentos_compra_atacado_delete on pagamentos_compra_atacado_licenca for delete to authenticated using (false);
