-- Honorários -- troca Stripe Connect por split PagBank (mesmo mecanismo já usado em
-- assinaturas/créditos-avulsos/licenças). Sem onboarding novo: reusa o pagbank_account_id
-- que o contador já cadastra em PATCH /contadores/:id/pagbank-conta.

alter table cobrancas_honorarios
  add column metodo text check (metodo is null or metodo in ('pix', 'cartao')),
  add column pagbank_order_id text,
  add column pix_code text,
  add column pix_qr_url text,
  add column split_ativo boolean not null default true;

alter table cobrancas_honorarios rename column stripe_payment_intent_id to pagbank_charge_id;

comment on column cobrancas_honorarios.pagbank_order_id is 'Setado na criação (síncrono) -- id da ordem PagBank, usado pelo webhook pra reconsultar antes de confiar no status.';
comment on column cobrancas_honorarios.pagbank_charge_id is 'Setado só quando o pagamento confirma (webhook) -- era stripe_payment_intent_id antes da migração pra PagBank.';

create index idx_cobrancas_honorarios_pagbank_order on cobrancas_honorarios(pagbank_order_id);

-- Substitui a versão antiga (guardava stripe_payment_intent_id) -- mesmos campos
-- protegidos conceitualmente, só trocando os nomes de coluna pro vocabulário PagBank.
create or replace function protege_campos_cobranca_honorario()
returns trigger
language plpgsql
as $$
begin
  if not eh_plataforma() then
    if new.status is distinct from old.status
       or new.pagbank_order_id is distinct from old.pagbank_order_id
       or new.pagbank_charge_id is distinct from old.pagbank_charge_id
       or new.pix_code is distinct from old.pix_code
       or new.pix_qr_url is distinct from old.pix_qr_url
       or new.pago_em is distinct from old.pago_em
       or new.comissao_pct is distinct from old.comissao_pct
       or new.comissao_valor is distinct from old.comissao_valor
    then
      raise exception 'Apenas a plataforma (via webhook PagBank) pode alterar status/comissão de uma cobrança';
    end if;
  end if;
  return new;
end;
$$;
