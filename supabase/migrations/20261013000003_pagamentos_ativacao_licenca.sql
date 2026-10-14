-- Rastreia a cobrança real (PagBank) da ativação de uma licença de módulo pra uma
-- empresa-cliente. A licença (licencas_modulo.status) só muda quando o pagamento
-- confirma via webhook -- esta tabela é a "intenção de ativar pagando", não a ativação.
create table pagamentos_ativacao_licenca (
  id uuid primary key default gen_random_uuid(),
  licenca_id uuid not null references licencas_modulo(id),
  contador_id uuid not null references contadores(id),
  empresa_id uuid not null references empresas(id),
  plano_revenda_id uuid not null references planos_revenda_pacote(id),
  valor_total numeric(12, 2) not null,
  platform_amount numeric(12, 2) not null,
  seller_amount numeric(12, 2) not null,
  metodo text not null check (metodo in ('pix', 'cartao')),
  pagbank_order_id text,
  pagbank_charge_id text,
  split_ativo boolean not null default false,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pago_em timestamptz
);

comment on column pagamentos_ativacao_licenca.platform_amount is 'Congelado no momento da ordem a partir de pacotes_modulos.preco -- não recalcula se o preço do pacote mudar depois.';

-- Só 1 tentativa pendente por licença ao mesmo tempo -- evita 2 ordens PagBank
-- concorrentes pra mesma licença.
create unique index idx_pagamentos_ativacao_licenca_pendente
  on pagamentos_ativacao_licenca(licenca_id) where status = 'pendente';

create index idx_pagamentos_ativacao_licenca_empresa on pagamentos_ativacao_licenca(empresa_id);
create index idx_pagamentos_ativacao_licenca_pagbank_order on pagamentos_ativacao_licenca(pagbank_order_id);

create trigger trg_pagamentos_ativacao_atualizado_em before update on pagamentos_ativacao_licenca
  for each row execute function set_atualizado_em();

-- Isolamento: empresa precisa pertencer à carteira do contador (mesmo padrão já usado
-- em outras tabelas de cobrança cross-tenant deste projeto).
create or replace function valida_posse_pagamento_ativacao_licenca()
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

create trigger trg_valida_posse_pagamento_ativacao_licenca
  before insert on pagamentos_ativacao_licenca
  for each row execute function valida_posse_pagamento_ativacao_licenca();

alter table pagamentos_ativacao_licenca enable row level security;

create policy pagamentos_ativacao_select on pagamentos_ativacao_licenca for select to authenticated
  using (eh_plataforma() or pode_acessar_contador(contador_id) or pode_acessar_empresa(empresa_id));
create policy pagamentos_ativacao_insert on pagamentos_ativacao_licenca for insert to authenticated
  with check (eh_plataforma() or contador_id = auth_contador_id());
-- Só backend (service role, via webhook) muda status -- nenhum papel autenticado via
-- RLS normal deveria conseguir marcar "pago" sozinho.
create policy pagamentos_ativacao_update on pagamentos_ativacao_licenca for update to authenticated
  using (eh_plataforma()) with check (eh_plataforma());
create policy pagamentos_ativacao_delete on pagamentos_ativacao_licenca for delete to authenticated using (false);
