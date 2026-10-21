-- Catálogo de pacotes de crédito avulso (top-up pontual, não é assinatura/plano
-- recorrente) -- compra 100% pra plataforma (Jota), sem split de contador, por isso não
-- tem nenhum valor de "sellerAmount"/conta de contador aqui (diferente de
-- pagamentos_assinatura_creditos).
create table pacotes_creditos_avulsos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  quantidade_creditos integer not null check (quantidade_creditos > 0),
  preco_reais numeric(12, 2) not null check (preco_reais > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_pacotes_creditos_avulsos_atualizado_em
  before update on pacotes_creditos_avulsos
  for each row execute function set_atualizado_em();

comment on table pacotes_creditos_avulsos is 'Pacotes de crédito avulso (top-up pontual) que a empresa-cliente (ou o contador em nome dela) pode comprar diretamente da plataforma, fora de qualquer plano/assinatura -- dinheiro 100% pra Jota, sem split.';

alter table pacotes_creditos_avulsos enable row level security;

create policy pacotes_creditos_avulsos_select on pacotes_creditos_avulsos for select to authenticated using (true);
create policy pacotes_creditos_avulsos_insert on pacotes_creditos_avulsos for insert to authenticated with check (eh_plataforma());
create policy pacotes_creditos_avulsos_update on pacotes_creditos_avulsos for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy pacotes_creditos_avulsos_delete on pacotes_creditos_avulsos for delete to authenticated using (false);

-- Pagamento (PIX PagBank, SEM split) de um pacote de crédito avulso -- note a ausência
-- de contador_id/seller_amount/plano_revenda_id (ao contrário de
-- pagamentos_assinatura_creditos): aqui não existe contador no meio da transação.
create table pagamentos_creditos_avulsos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  pacote_id uuid not null references pacotes_creditos_avulsos(id),
  valor_total numeric(12, 2) not null,
  pagbank_order_id text,
  pagbank_charge_id text,
  pix_code text,
  pix_qr_url text,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pago_em timestamptz
);

comment on column pagamentos_creditos_avulsos.valor_total is 'Congelado a partir de pacotes_creditos_avulsos.preco_reais no momento da ordem -- não recalcula se o preço do pacote mudar depois (mesmo cuidado de platform_amount em pagamentos_assinatura_creditos).';

create unique index idx_pagamentos_creditos_avulsos_pendente
  on pagamentos_creditos_avulsos(empresa_id) where status = 'pendente';

create index idx_pagamentos_creditos_avulsos_empresa on pagamentos_creditos_avulsos(empresa_id);
create index idx_pagamentos_creditos_avulsos_pagbank_order on pagamentos_creditos_avulsos(pagbank_order_id);

create trigger trg_pagamentos_creditos_avulsos_atualizado_em before update on pagamentos_creditos_avulsos
  for each row execute function set_atualizado_em();

alter table pagamentos_creditos_avulsos enable row level security;

-- Mesmo padrão de pagamentos_assinatura_creditos: plataforma, contador da carteira da
-- empresa (pode iniciar em nome dela) ou a própria empresa (self-service) leem; só o
-- backend (service role, via webhook) muda status.
create policy pagamentos_creditos_avulsos_select on pagamentos_creditos_avulsos for select to authenticated
  using (eh_plataforma() or pode_acessar_empresa(empresa_id));
create policy pagamentos_creditos_avulsos_insert on pagamentos_creditos_avulsos for insert to authenticated
  with check (eh_plataforma() or pode_acessar_empresa(empresa_id));
create policy pagamentos_creditos_avulsos_update on pagamentos_creditos_avulsos for update to authenticated
  using (eh_plataforma()) with check (eh_plataforma());
create policy pagamentos_creditos_avulsos_delete on pagamentos_creditos_avulsos for delete to authenticated using (false);
