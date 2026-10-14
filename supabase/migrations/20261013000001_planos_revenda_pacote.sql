-- "Plano de revenda" do contador: preço de venda ao cliente final de um pacote de
-- módulos, com margem sobre o preço de atacado (pacotes_modulos.preco). Substitui o
-- campo livre valorCobrado (digitado a cada ativação, nunca persistido) por algo
-- reutilizável -- contador cadastra uma vez, usa em todas as ativações daquele pacote.
create table planos_revenda_pacote (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  pacote_id uuid not null references pacotes_modulos(id),
  nome text,
  valor_venda numeric(12, 2) not null check (valor_venda > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column planos_revenda_pacote.nome is 'Null = herda pacote.nome, resolvido na Application.';

-- Só 1 plano de revenda ATIVO por (contador, pacote) -- evita ambiguidade na hora de
-- ativar (qual plano usar se houver dois?).
create unique index idx_planos_revenda_contador_pacote_ativo
  on planos_revenda_pacote(contador_id, pacote_id) where ativo;

create trigger trg_planos_revenda_atualizado_em before update on planos_revenda_pacote
  for each row execute function set_atualizado_em();

-- Margem nunca negativa: valor_venda >= pacote.preco ATUAL (não congelado) -- revalidado
-- a cada INSERT/UPDATE porque o preço do pacote pode mudar depois de o plano já existir.
create or replace function valida_margem_plano_revenda()
returns trigger
language plpgsql
as $$
declare
  v_preco_pacote numeric(12, 2);
begin
  select preco into v_preco_pacote from pacotes_modulos where id = new.pacote_id;
  if v_preco_pacote is null then
    raise exception 'Pacote informado não existe';
  end if;
  if new.valor_venda < v_preco_pacote then
    raise exception 'Valor de venda não pode ser menor que o repasse da plataforma (%).', v_preco_pacote;
  end if;
  return new;
end;
$$;

create trigger trg_valida_margem_plano_revenda
  before insert or update on planos_revenda_pacote
  for each row execute function valida_margem_plano_revenda();

alter table planos_revenda_pacote enable row level security;

create policy planos_revenda_select on planos_revenda_pacote for select to authenticated
  using (eh_plataforma() or auth_contador_id() = contador_id);
create policy planos_revenda_insert on planos_revenda_pacote for insert to authenticated
  with check (auth_contador_id() = contador_id);
create policy planos_revenda_update on planos_revenda_pacote for update to authenticated
  using (auth_contador_id() = contador_id) with check (auth_contador_id() = contador_id);
create policy planos_revenda_delete on planos_revenda_pacote for delete to authenticated using (false);

insert into permissoes (recurso, acao) values
  ('planos_revenda_pacote', 'visualizar'), ('planos_revenda_pacote', 'criar'), ('planos_revenda_pacote', 'editar')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('CONTADOR_DONO', 'OPERADOR_CONTADOR')
  and perm.recurso = 'planos_revenda_pacote'
on conflict do nothing;
