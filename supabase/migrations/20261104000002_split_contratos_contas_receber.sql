-- Link de pagamento PagBank (com split) pra parcela de Contas a Receber -- mesmo
-- mecanismo já em produção em honorários/créditos-avulsos/assinatura-créditos/licença
-- atacado, agora aplicado a QUALQUER empresa (não só contador): o credor de uma conta a
-- receber (contador cobrando cliente dele, ou empresa-cliente cobrando o PRÓPRIO
-- cliente, ou o admin cobrando um cliente direto da plataforma) gera um link; o cliente
-- paga; a Jota fica com uma comissão % (nova, separada da de honorários); o resto cai
-- pra conta PagBank da própria empresa credora.

-- ============================================================
-- Conta PagBank própria de cada empresa + banco padrão pra conciliar automático
-- ============================================================

alter table empresas
  add column pagbank_account_id text,
  add column banco_pagbank_id uuid references bancos(id);

comment on column empresas.pagbank_account_id is 'Conta PagBank PRÓPRIA desta empresa (contador, empresa-cliente ou a interna_plataforma do admin) -- cadastro manual, mesmo padrão simples de contadores.pagbank_account_id. Recebe a parte "seller" do split de qualquer link de pagamento gerado em nome desta empresa.';
comment on column empresas.banco_pagbank_id is 'Banco (rótulo em /bancos) que recebe automaticamente o lançamento contábil quando um link de pagamento PagBank confirma -- sem isso, o link não pode ser gerado (precisa saber onde conciliar).';

-- Banco escolhido precisa pertencer à própria empresa -- nunca o banco de outra.
create or replace function valida_banco_pagbank_da_empresa()
returns trigger
language plpgsql
as $$
begin
  if new.banco_pagbank_id is not null and not exists (
    select 1 from bancos where id = new.banco_pagbank_id and empresa_id = new.id
  ) then
    raise exception 'O banco padrão de recebimento PagBank precisa pertencer à própria empresa';
  end if;
  return new;
end;
$$;

create trigger trg_valida_banco_pagbank_da_empresa
  before insert or update on empresas
  for each row execute function valida_banco_pagbank_da_empresa();

-- ============================================================
-- Comissão da plataforma sobre link de pagamento de contratos/contas a receber
-- ============================================================

alter table configuracoes_plataforma
  add column comissao_contratos_pct numeric(5,2) not null default 5.00
    check (comissao_contratos_pct >= 0 and comissao_contratos_pct <= 100);

comment on column configuracoes_plataforma.comissao_contratos_pct is 'Comissão da Jota sobre link de pagamento PagBank de parcela de Contas a Receber (contrato) -- separada da comissão de honorários, mesmo singleton/editável só por SUPER_ADMIN/ADMIN_FINANCEIRO.';

-- Mesma auditoria automática que a comissão de honorários já tem.
create or replace function audita_mudanca_comissao_contratos_plataforma()
returns trigger
language plpgsql
as $$
begin
  insert into logs_auditoria (usuario_id, acao, recurso, dados_antigos, dados_novos)
  values (
    auth.uid(),
    'atualizar',
    'configuracoes_plataforma',
    jsonb_build_object('comissao_contratos_pct', old.comissao_contratos_pct),
    jsonb_build_object('comissao_contratos_pct', new.comissao_contratos_pct)
  );
  return new;
end;
$$;

create trigger trg_audita_mudanca_comissao_contratos_plataforma
  after update on configuracoes_plataforma
  for each row
  when (old.comissao_contratos_pct is distinct from new.comissao_contratos_pct)
  execute function audita_mudanca_comissao_contratos_plataforma();

-- ============================================================
-- Links de pagamento de parcela (destination charge)
-- ============================================================

create table links_pagamento_parcela (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references parcelas_contas_receber(id),
  empresa_id uuid not null references empresas(id),
  cliente_id uuid references clientes(id),
  valor numeric(14,2) not null check (valor > 0),
  comissao_pct numeric(5,2) not null,
  comissao_valor numeric(14,2) not null,
  metodo text not null check (metodo in ('pix', 'cartao')),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou')),
  pagbank_order_id text,
  pagbank_charge_id text,
  pix_code text,
  pix_qr_url text,
  recebimento_id uuid references recebimentos_contas_receber(id),
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pago_em timestamptz
);

comment on table links_pagamento_parcela is 'Link de pagamento PagBank com split pra uma parcela de contas_receber -- comissao_pct/comissao_valor congelados na criação (trigger definir_comissao_link_pagamento_parcela), nunca recalculados se a comissão global mudar depois. Quando confirma (webhook), gera um recebimento real (recebimento_id) no banco padrão da empresa (empresas.banco_pagbank_id).';

create index idx_links_pagamento_parcela_parcela on links_pagamento_parcela(parcela_id);
create index idx_links_pagamento_parcela_empresa on links_pagamento_parcela(empresa_id);
create index idx_links_pagamento_parcela_pagbank_order on links_pagamento_parcela(pagbank_order_id);

create trigger trg_set_atualizado_em before update on links_pagamento_parcela
  for each row execute function set_atualizado_em();

-- Isolamento: a parcela informada precisa pertencer à mesma empresa que está gerando o
-- link (defesa em profundidade, mesmo padrão de valida_posse_cobranca_honorario).
create or replace function valida_vinculo_link_pagamento_parcela()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from parcelas_contas_receber where id = new.parcela_id and empresa_id = new.empresa_id
  ) then
    raise exception 'A parcela informada não pertence a esta empresa';
  end if;
  return new;
end;
$$;

create trigger trg_valida_vinculo_link_pagamento_parcela
  before insert on links_pagamento_parcela
  for each row execute function valida_vinculo_link_pagamento_parcela();

-- Comissão nunca vem do cliente -- sempre recalculada a partir da config global no
-- momento da criação, e congelada dali em diante. SECURITY DEFINER pelo mesmo motivo de
-- definir_comissao_honorario: configuracoes_plataforma só é visível via RLS pra
-- eh_plataforma(), mas contador/empresa também disparam a criação do link.
create or replace function definir_comissao_link_pagamento_parcela()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comissao_pct numeric(5,2);
begin
  select comissao_contratos_pct into v_comissao_pct from configuracoes_plataforma where id = 1;
  new.comissao_pct := v_comissao_pct;
  new.comissao_valor := round(new.valor * v_comissao_pct / 100.0, 2);
  return new;
end;
$$;

create trigger trg_definir_comissao_link_pagamento_parcela
  before insert on links_pagamento_parcela
  for each row execute function definir_comissao_link_pagamento_parcela();

-- Depois de criado, só a plataforma (via webhook PagBank) pode mudar status/dados de
-- pagamento/recebimento -- contador/empresa não pode se "auto-marcar" como pago.
create or replace function protege_campos_link_pagamento_parcela()
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
       or new.recebimento_id is distinct from old.recebimento_id
       or new.pago_em is distinct from old.pago_em
       or new.comissao_pct is distinct from old.comissao_pct
       or new.comissao_valor is distinct from old.comissao_valor
    then
      raise exception 'Apenas a plataforma (via webhook PagBank) pode alterar status/dados deste link de pagamento';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protege_campos_link_pagamento_parcela
  before update on links_pagamento_parcela
  for each row execute function protege_campos_link_pagamento_parcela();

-- ============================================================
-- RLS
-- ============================================================

alter table links_pagamento_parcela enable row level security;

-- Os dois lados (quem gerou o link, a empresa credora) enxergam; qualquer um com acesso
-- à empresa pode criar (contador dono OU a própria empresa-cliente OU admin); só a
-- plataforma muda status depois de criado.
create policy links_pagamento_parcela_select on links_pagamento_parcela for select to authenticated
  using (pode_acessar_empresa(empresa_id));
create policy links_pagamento_parcela_insert on links_pagamento_parcela for insert to authenticated
  with check (pode_acessar_empresa(empresa_id));
create policy links_pagamento_parcela_update on links_pagamento_parcela for update to authenticated
  using (eh_plataforma())
  with check (eh_plataforma());
create policy links_pagamento_parcela_delete on links_pagamento_parcela for delete to authenticated using (false); -- nunca hard delete
