-- "Plano de revenda" do contador pra pacotes de crédito avulso -- mesmo espírito de
-- planos_revenda_pacote (módulos), mas em cima de pacotes_creditos_avulsos. Contador
-- cadastra uma vez o valor de venda (margem sobre pacotes_creditos_avulsos.preco_reais),
-- empresa compra ESSE pacote específico do contador (em vez do pacote direto da
-- plataforma) e o PIX sai com split -- mesmo mecanismo de iniciar-pagamento-ativacao-licenca.
create table planos_revenda_creditos_avulsos (
  id uuid primary key default gen_random_uuid(),
  contador_id uuid not null references contadores(id),
  pacote_id uuid not null references pacotes_creditos_avulsos(id),
  nome text,
  valor_venda numeric(12, 2) not null check (valor_venda > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column planos_revenda_creditos_avulsos.nome is 'Null = herda pacote.nome, resolvido na Application.';

-- Só 1 plano de revenda ATIVO por (contador, pacote) -- mesma regra de planos_revenda_pacote.
create unique index idx_planos_revenda_creditos_avulsos_contador_pacote_ativo
  on planos_revenda_creditos_avulsos(contador_id, pacote_id) where ativo;

create trigger trg_planos_revenda_creditos_avulsos_atualizado_em before update on planos_revenda_creditos_avulsos
  for each row execute function set_atualizado_em();

-- Margem nunca negativa: valor_venda >= pacote.preco_reais ATUAL (não congelado) -- mesmo
-- padrão de valida_margem_plano_revenda, só trocando a tabela de origem do preço.
create or replace function valida_margem_plano_revenda_creditos_avulsos()
returns trigger
language plpgsql
as $$
declare
  v_preco_pacote numeric(12, 2);
begin
  select preco_reais into v_preco_pacote from pacotes_creditos_avulsos where id = new.pacote_id;
  if v_preco_pacote is null then
    raise exception 'Pacote de crédito avulso informado não existe';
  end if;
  if new.valor_venda < v_preco_pacote then
    raise exception 'Valor de venda não pode ser menor que o repasse da plataforma (%).', v_preco_pacote;
  end if;
  return new;
end;
$$;

create trigger trg_valida_margem_plano_revenda_creditos_avulsos
  before insert or update on planos_revenda_creditos_avulsos
  for each row execute function valida_margem_plano_revenda_creditos_avulsos();

alter table planos_revenda_creditos_avulsos enable row level security;

create policy planos_revenda_creditos_avulsos_select on planos_revenda_creditos_avulsos for select to authenticated
  using (eh_plataforma() or auth_contador_id() = contador_id);
create policy planos_revenda_creditos_avulsos_insert on planos_revenda_creditos_avulsos for insert to authenticated
  with check (auth_contador_id() = contador_id);
create policy planos_revenda_creditos_avulsos_update on planos_revenda_creditos_avulsos for update to authenticated
  using (auth_contador_id() = contador_id) with check (auth_contador_id() = contador_id);
create policy planos_revenda_creditos_avulsos_delete on planos_revenda_creditos_avulsos for delete to authenticated using (false);

insert into permissoes (recurso, acao) values
  ('planos_revenda_creditos_avulsos', 'visualizar'), ('planos_revenda_creditos_avulsos', 'criar'), ('planos_revenda_creditos_avulsos', 'editar')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('CONTADOR_DONO', 'OPERADOR_CONTADOR')
  and perm.recurso = 'planos_revenda_creditos_avulsos'
on conflict do nothing;

-- Pagamento de crédito avulso passa a suportar DOIS caminhos: direto da plataforma (sem
-- split, colunas abaixo ficam null, comportamento original preservado) ou via o plano de
-- revenda de um contador (com split, as 4 colunas vêm preenchidas juntas). `pacote_id`
-- sempre aponta pro pacote-base real (mesmo com compra via revenda) -- quem credita no
-- webhook nunca precisa saber se passou por um contador ou não.
alter table pagamentos_creditos_avulsos
  add column contador_id uuid references contadores(id),
  add column plano_revenda_id uuid references planos_revenda_creditos_avulsos(id),
  add column platform_amount numeric(12, 2),
  add column seller_amount numeric(12, 2);

comment on column pagamentos_creditos_avulsos.platform_amount is 'Congelado a partir de pacotes_creditos_avulsos.preco_reais no momento da ordem -- só preenchido quando a compra passa pelo plano de revenda de um contador (null = compra direta, sem split).';

alter table pagamentos_creditos_avulsos add constraint chk_pagamentos_creditos_avulsos_split_coeso
  check (
    (contador_id is null and plano_revenda_id is null and platform_amount is null and seller_amount is null)
    or
    (contador_id is not null and plano_revenda_id is not null and platform_amount is not null and seller_amount is not null)
  );

create index idx_pagamentos_creditos_avulsos_contador on pagamentos_creditos_avulsos(contador_id);
