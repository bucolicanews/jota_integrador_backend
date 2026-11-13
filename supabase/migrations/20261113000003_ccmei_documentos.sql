-- CCMEI (Certificado da Condição de Microempreendedor Individual) cacheado, mesmo
-- padrão já usado em declaracoes_pgdas/das_mei (20261020000001): o PDF nunca fica na
-- tabela (vem em base64 do SERPRO, idSistema CCMEI/idServico DADOSCCMEI122), só o
-- `pdf_storage_ref` do bucket privado. Diferente do DAS (1 documento por COMPETÊNCIA),
-- CCMEI é 1 documento por EMPRESA -- não expira sozinho (confirmado com o usuário
-- 2026-11-13): só reconsulta o SERPRO e gasta crédito de novo se o usuário clicar
-- "Atualizar" explicitamente.
create table ccmei_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique references empresas(id),
  pdf_storage_ref text,
  consultado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_ccmei_documentos_empresa on ccmei_documentos(empresa_id);

comment on column ccmei_documentos.pdf_storage_ref is 'Path no bucket privado ccmei-documentos, não URL pública -- leitura só via signed URL gerada pelo backend após checar posse, mesmo padrão de declaracoes_pgdas.pdf_storage_ref.';

create trigger trg_ccmei_documentos_atualizado_em before update on ccmei_documentos
  for each row execute function set_atualizado_em();

alter table ccmei_documentos enable row level security;

-- Mesma lógica de das_mei: dado sincronizado do SERPRO, nunca editado manualmente pelo usuário final.
create policy ccmei_documentos_select on ccmei_documentos for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy ccmei_documentos_insert on ccmei_documentos for insert to authenticated with check (eh_plataforma());
create policy ccmei_documentos_update on ccmei_documentos for update to authenticated using (eh_plataforma()) with check (eh_plataforma());
create policy ccmei_documentos_delete on ccmei_documentos for delete to authenticated using (false);

-- Bucket privado -- upload/leitura só via backend (service_role), nunca direto do browser.
insert into storage.buckets (id, name, public)
values ('ccmei-documentos', 'ccmei-documentos', false)
on conflict (id) do nothing;
