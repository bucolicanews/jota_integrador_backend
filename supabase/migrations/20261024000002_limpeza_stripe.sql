-- Limpeza final da remoção do Stripe (Fase 5) -- todo o sistema agora usa PagBank como
-- único gateway (assinatura/créditos-avulsos/licenças/honorários, Fases 1-4). Colunas
-- abaixo não têm mais nenhum leitor/escritor no código desde a Fase 4.

-- Reescreve o trigger ANTES de dropar as colunas que ele referencia (senão o DROP COLUMN
-- falha com "cannot drop column X because other objects depend on it").
create or replace function protege_campos_sensiveis_contador()
returns trigger
language plpgsql
as $$
begin
  if not eh_plataforma() then
    if new.bloqueado is distinct from old.bloqueado
       or new.tipo is distinct from old.tipo
    then
      raise exception 'Apenas a equipe da plataforma pode alterar estes campos de contadores';
    end if;
  end if;
  return new;
end;
$$;

alter table contadores
  drop column stripe_customer_id,
  drop column stripe_account_id,
  drop column stripe_charges_enabled,
  drop column stripe_payouts_enabled,
  drop column stripe_details_submitted;

-- licencas_modulo.stripe_subscription_id -- resquício de quando o atacado era assinatura
-- recorrente Stripe (Fase 3 já trocou pra compra avulsa PagBank, sem recorrência).
alter table licencas_modulo drop column stripe_subscription_id;
