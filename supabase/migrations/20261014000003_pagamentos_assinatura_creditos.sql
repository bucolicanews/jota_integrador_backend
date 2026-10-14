-- Pagamento (PIX com split PagBank) de uma assinatura de créditos por empresa -- cópia
-- exata de pagamentos_ativacao_licenca (20261013000003), trocando licenca_id por plano_id
-- (não existe "licença" aqui, só plano de créditos + plano de revenda do contador).
create table pagamentos_assinatura_creditos (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  empresa_id uuid not null references empresas(id),
  plano_id uuid not null references planos(id),
  plano_revenda_id uuid not null references planos_revenda_creditos(id),
  valor_total numeric(12, 2) not null,
  platform_amount numeric(12, 2) not null,
  seller_amount numeric(12, 2) not null,
  metodo text not null check (metodo in ('pix', 'cartao')),
  pagbank_order_id text,
  pagbank_charge_id text,
  -- Persiste o código/QR PIX gerado (mesmo motivo de 20261013000004 em
  -- pagamentos_ativacao_licenca: empresa-cliente precisa ver a pendência numa tela
  -- própria depois, não só na resposta imediata de iniciar-pagamento).
  pix_code text,
  pix_qr_url text,
  split_ativo boolean not null default false,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pago_em timestamptz
);

comment on column pagamentos_assinatura_creditos.platform_amount is 'Congelado no momento da ordem a partir de planos.preco -- não recalcula se o preço do plano mudar depois.';

-- Só 1 tentativa pendente por empresa ao mesmo tempo -- evita 2 ordens PagBank
-- concorrentes pra mesma empresa.
create unique index idx_pagamentos_assinatura_creditos_pendente
  on pagamentos_assinatura_creditos(empresa_id) where status = 'pendente';

create index idx_pagamentos_assinatura_creditos_empresa on pagamentos_assinatura_creditos(empresa_id);
create index idx_pagamentos_assinatura_creditos_pagbank_order on pagamentos_assinatura_creditos(pagbank_order_id);

create trigger trg_pagamentos_assinatura_creditos_atualizado_em before update on pagamentos_assinatura_creditos
  for each row execute function set_atualizado_em();

-- Isolamento: empresa precisa pertencer à carteira do contador -- mesma regra de
-- pagamentos_ativacao_licenca.
create or replace function valida_posse_pagamento_assinatura_creditos()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from empresas where id = new.empresa_id and contador_id = new.contador_id) then
    raise exception 'A empresa informada não pertence à carteira deste contador';
  end if;
  return new;
end;
$$;

create trigger trg_valida_posse_pagamento_assinatura_creditos
  before insert on pagamentos_assinatura_creditos
  for each row execute function valida_posse_pagamento_assinatura_creditos();

alter table pagamentos_assinatura_creditos enable row level security;

create policy pagamentos_assinatura_creditos_select on pagamentos_assinatura_creditos for select to authenticated
  using (eh_plataforma() or pode_acessar_contador(contador_id) or pode_acessar_empresa(empresa_id));
create policy pagamentos_assinatura_creditos_insert on pagamentos_assinatura_creditos for insert to authenticated
  with check (eh_plataforma() or contador_id = auth_contador_id());
-- Só backend (service role, via webhook) muda status -- mesma regra de pagamentos_ativacao_licenca.
create policy pagamentos_assinatura_creditos_update on pagamentos_assinatura_creditos for update to authenticated
  using (eh_plataforma()) with check (eh_plataforma());
create policy pagamentos_assinatura_creditos_delete on pagamentos_assinatura_creditos for delete to authenticated using (false);
