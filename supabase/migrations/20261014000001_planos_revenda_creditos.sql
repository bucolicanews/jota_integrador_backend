-- Plano de revenda de créditos SERPRO -- mesmo conceito de planos_revenda_pacote
-- (20261013000001), trocando pacote_id por plano_id. Contador define quanto cobra da
-- própria empresa-cliente por um dos planos de créditos do catálogo (planos).
create table planos_revenda_creditos (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  plano_id uuid not null references planos(id),
  nome text,
  valor_venda numeric(12, 2) not null check (valor_venda > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column planos_revenda_creditos.nome is 'Null = herda plano.nome, resolvido na Application.';

-- Só 1 plano de revenda ATIVO por (contador, plano) -- mesma regra de planos_revenda_pacote.
create unique index idx_planos_revenda_creditos_contador_plano_ativo
  on planos_revenda_creditos(contador_id, plano_id) where ativo;

create trigger trg_planos_revenda_creditos_atualizado_em before update on planos_revenda_creditos
  for each row execute function set_atualizado_em();

-- Margem nunca negativa: valor_venda >= planos.preco ATUAL (não congelado) -- mesma regra
-- de valida_margem_plano_revenda (planos_revenda_pacote), espelhada aqui pro catálogo de planos.
create or replace function valida_margem_plano_revenda_creditos()
returns trigger
language plpgsql
as $$
declare
  v_preco_plano numeric(12, 2);
begin
  select preco into v_preco_plano from planos where id = new.plano_id;
  if v_preco_plano is null then
    raise exception 'Plano informado não existe';
  end if;
  if new.valor_venda < v_preco_plano then
    raise exception 'Valor de venda não pode ser menor que o repasse da plataforma (%).', v_preco_plano;
  end if;
  return new;
end;
$$;

create trigger trg_valida_margem_plano_revenda_creditos
  before insert or update on planos_revenda_creditos
  for each row execute function valida_margem_plano_revenda_creditos();

alter table planos_revenda_creditos enable row level security;

create policy planos_revenda_creditos_select on planos_revenda_creditos for select to authenticated
  using (eh_plataforma() or auth_contador_id() = contador_id);
create policy planos_revenda_creditos_insert on planos_revenda_creditos for insert to authenticated
  with check (auth_contador_id() = contador_id);
create policy planos_revenda_creditos_update on planos_revenda_creditos for update to authenticated
  using (auth_contador_id() = contador_id) with check (auth_contador_id() = contador_id);
create policy planos_revenda_creditos_delete on planos_revenda_creditos for delete to authenticated using (false);
