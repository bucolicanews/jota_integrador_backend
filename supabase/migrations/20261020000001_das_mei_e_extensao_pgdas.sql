-- Módulo DAS (Documento de Arrecadação do Simples Nacional/MEI). Dois caminhos
-- SERPRO distintos por regime (confirmado no catálogo oficial Integra Contador):
--
-- MEI (PGMEI): o DAS mensal é autocontido -- idServico GERARDASPDF21 gera o PDF direto
-- por período de apuração, sem depender de nenhuma declaração prévia. Não existia
-- nenhuma tabela pra isso -- `das_mei` é nova.
--
-- Simples Nacional ME/EPP (PGDASD): o DAS só existe DEPOIS de uma declaração já
-- transmitida (idServico CONSDECLARACAO13 lista declarações, CONSEXTRATO16 traz o
-- extrato/PDF por numeroDas) -- uma declaração gera exatamente um DAS, por isso
-- reaproveita `declaracoes_pgdas` (20260906000005_fiscal.sql), que já existia como
-- esqueleto da Fase 3 nunca implementado, em vez de criar tabela nova.
--
-- Em ambos os casos, o PDF nunca fica na tabela (vem em base64 do SERPRO) -- só o
-- `storage_ref` do bucket privado, mesmo padrão de `protocolos`/`contratos`
-- (signed URL de curta duração gerada sob demanda pelo backend, nunca URL pública).

alter table declaracoes_pgdas add column numero_das text;
alter table declaracoes_pgdas add column codigo_barras text;
alter table declaracoes_pgdas add column pdf_storage_ref text;
alter table declaracoes_pgdas add column pago_em timestamptz;
alter table declaracoes_pgdas add column sincronizado_em timestamptz;
alter table declaracoes_pgdas add column atualizado_em timestamptz not null default now();

-- Nunca existia constraint de dedupe -- sem isso, sincronizar de novo duplicaria a
-- mesma competência (mesmo raciocínio de idx_mensagens_caixa_postal_empresa_isn).
create unique index idx_declaracoes_pgdas_empresa_competencia on declaracoes_pgdas(empresa_id, competencia);

comment on column declaracoes_pgdas.numero_das is 'numeroDas retornado pelo SERPRO (PGDASD/CONSDECLARACAO13) -- chave usada em CONSEXTRATO16 e no lote de PAGTOWEB/PAGAMENTOS71.';
comment on column declaracoes_pgdas.pdf_storage_ref is 'Path no bucket privado das-documentos, não URL pública -- leitura só via signed URL gerada pelo backend após checar posse.';
comment on column declaracoes_pgdas.pago_em is 'Preenchido pela sincronização ao confirmar pagamento via PAGTOWEB/PAGAMENTOS71 -- nunca setado manualmente pelo usuário final.';

create trigger trg_declaracoes_pgdas_atualizado_em before update on declaracoes_pgdas
  for each row execute function set_atualizado_em();

create table das_mei (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  competencia date not null,
  numero_documento text,
  codigo_barras text,
  valor numeric(14,2) not null check (valor >= 0),
  vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  pago_em timestamptz,
  pdf_storage_ref text,
  sincronizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index idx_das_mei_empresa_competencia on das_mei(empresa_id, competencia);
create index idx_das_mei_empresa on das_mei(empresa_id);

comment on table das_mei is 'DAS mensal do MEI (PGMEI/GERARDASPDF21) -- autocontido, sem declaração prévia, por isso não cabe em declaracoes_pgdas (que é Simples Nacional ME/EPP).';
comment on column das_mei.status is 'pendente|pago -- "vencido" é CALCULADO na aplicação (vencimento < hoje e status != pago), nunca armazenado aqui.';
comment on column das_mei.pdf_storage_ref is 'Path no bucket privado das-documentos, não URL pública -- mesmo padrão de declaracoes_pgdas.pdf_storage_ref.';

create trigger trg_das_mei_atualizado_em before update on das_mei
  for each row execute function set_atualizado_em();

alter table das_mei enable row level security;

-- Mesma lógica já usada em declaracoes_pgdas/documentos_fiscais: dado sincronizado do
-- SERPRO, nunca editado manualmente pelo usuário final.
create policy das_mei_select on das_mei for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy das_mei_insert on das_mei for insert to authenticated with check (eh_plataforma());
create policy das_mei_update on das_mei for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy das_mei_delete on das_mei for delete to authenticated using (false);

-- Bucket privado -- upload/leitura só via backend (service_role), nunca direto do browser.
insert into storage.buckets (id, name, public)
values ('das-documentos', 'das-documentos', false)
on conflict (id) do nothing;
