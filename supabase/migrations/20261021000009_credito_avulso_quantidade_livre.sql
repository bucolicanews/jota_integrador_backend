-- Valor por crédito configurável pelo admin (ex: R$1,00/crédito) -- base pra compra de
-- crédito avulso em QUANTIDADE LIVRE (empresa/contador digita "37 créditos" e paga
-- 37 * valor_por_credito), coexistindo com os pacotes com desconto fixo
-- (pacotes_creditos_avulsos, ex: 15 por R$13) e com o pacote de revenda do contador.
-- Singleton: `id` sempre `true`, a PK garante que nunca existe mais de uma linha.
create table configuracao_creditos_avulsos (
  id boolean primary key default true,
  valor_por_credito numeric(10, 4) not null check (valor_por_credito > 0),
  atualizado_em timestamptz not null default now(),
  constraint chk_configuracao_creditos_avulsos_singleton check (id)
);

create trigger trg_configuracao_creditos_avulsos_atualizado_em before update on configuracao_creditos_avulsos
  for each row execute function set_atualizado_em();

insert into configuracao_creditos_avulsos (id, valor_por_credito) values (true, 1.00);

alter table configuracao_creditos_avulsos enable row level security;

create policy configuracao_creditos_avulsos_select on configuracao_creditos_avulsos for select to authenticated using (true);
create policy configuracao_creditos_avulsos_update on configuracao_creditos_avulsos for update to authenticated
  using (eh_plataforma()) with check (eh_plataforma());
create policy configuracao_creditos_avulsos_insert on configuracao_creditos_avulsos for insert to authenticated with check (false);
create policy configuracao_creditos_avulsos_delete on configuracao_creditos_avulsos for delete to authenticated using (false);

-- Compra por quantidade livre não referencia nenhum pacote do catálogo -- pacote_id some
-- opcional, e quantidade_creditos passa a ser gravada SEMPRE (inclusive pra compras de
-- pacote, copiada de pacotes_creditos_avulsos.quantidade_creditos no momento da ordem) --
-- "congelado no momento da ordem", mesmo cuidado já usado em valor_total/platform_amount
-- nesta mesma tabela. O webhook credita direto daqui, nunca mais precisa reconsultar o
-- pacote (resiliente até a pacote ser desativado/apagado entre a compra e a confirmação).
alter table pagamentos_creditos_avulsos alter column pacote_id drop not null;
-- Tabela ainda sem nenhuma linha em produção (confirmado antes desta migration) -- pode
-- entrar direto como NOT NULL, sem precisar de backfill.
alter table pagamentos_creditos_avulsos add column quantidade_creditos integer not null check (quantidade_creditos > 0);

comment on column pagamentos_creditos_avulsos.quantidade_creditos is 'Congelado no momento da ordem -- pacote (pacotes_creditos_avulsos.quantidade_creditos) ou quantidade livre digitada, sempre preenchido independente do caminho.';
