-- Fase 6 do port do jotaCaixa: Contratos (financeiro) + Documentos Societários. Minerado
-- (só leitura) de jotaCaixa/src/{pages/{NovoContrato,PreencherContrato,Contratos,
-- AssinarContrato,ContratoLinkPage,GerarDocumentoSocietario,GerenciarModelosSocietarios,
-- GerenciarBlocosSocietarios,DocumentosSocietarios}.tsx, components/{contratos,
-- documentos-societarios}.tsx, config/contrato-tags-padrao.ts}.
--
-- Dois sistemas quase idênticos que compartilham a mesma engine de tags {{TAG}}, mantidos
-- como módulos SEPARADOS (decisão explícita do usuário) por terem preocupações diferentes:
-- Contratos tem vínculo financeiro (gera contas_receber) + assinatura eletrônica pública;
-- Documentos Societários não tem financeiro, mas tem blocos de texto reutilizáveis.
--
-- Desvio deliberado do jotaCaixa: lá a assinatura pública roda via RPC Postgres pública
-- bypassando RLS, e a selfie vai pra bucket público. Aqui é um controller NestJS público
-- (sem SupabaseAuthGuard, throttle restrito) + bucket privado com leitura só via signed
-- URL -- mesmo desvio já aplicado em Protocolos/Caixa Postal.

-- ============================================================
-- Contratos
-- ============================================================

create table modelos_contrato (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  titulo text not null,
  conteudo_template text not null,
  tipo_conteudo text not null default 'html' check (tipo_conteudo in ('html', 'texto')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_modelos_contrato_empresa on modelos_contrato(empresa_id);

create trigger trg_modelos_contrato_atualizado_em before update on modelos_contrato
  for each row execute function set_atualizado_em();

comment on table modelos_contrato is 'Templates de contrato com tags {{TAG}} -- conteudo_template nunca muda o conteúdo já renderizado/assinado em contratos_gerados (snapshot imutável).';

-- Singleton por empresa: de onde saem os lançamentos gerados quando um contrato tem
-- valor financeiro. Sem linha aqui, CriarContratoUseCase recusa contrato com valor > 0.
create table configuracao_contratos (
  empresa_id uuid primary key references empresas(id),
  conta_patrimonial_receber_id uuid references plano_contas(id),
  conta_resultado_receita_id uuid references plano_contas(id),
  url_base_assinatura text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_configuracao_contratos_atualizado_em before update on configuracao_contratos
  for each row execute function set_atualizado_em();

create table contratos_gerados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  modelo_id uuid references modelos_contrato(id),
  cliente_id uuid not null references clientes(id),
  titulo text not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'pendente_assinatura', 'ativo', 'cancelado', 'concluido', 'bloqueado')),
  valores_tags jsonb not null default '{}',
  conteudo_renderizado text not null,
  valor_total numeric(14, 2),
  conta_receber_id uuid references contas_receber(id), -- só existe se valor_total > 0
  -- Token opaco: a URL pública de assinatura nunca expõe o UUID real do contrato.
  token_assinatura text not null unique default encode(gen_random_bytes(24), 'hex'),
  assinatura_nome text,
  assinatura_selfie_ref text, -- path no bucket privado contratos-selfies, nunca URL pública
  assinado_em timestamptz,
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_contratos_gerados_empresa on contratos_gerados(empresa_id);
create index idx_contratos_gerados_cliente on contratos_gerados(cliente_id);
create index idx_contratos_gerados_token on contratos_gerados(token_assinatura);

create trigger trg_contratos_gerados_atualizado_em before update on contratos_gerados
  for each row execute function set_atualizado_em();

comment on table contratos_gerados is 'conteudo_renderizado é snapshot imutável no momento da criação -- editar modelos_contrato depois não altera contrato já gerado.';
comment on column contratos_gerados.token_assinatura is 'Único, opaco, usado na URL pública de assinatura (/assinar-contrato/:token) -- nunca expor o id (uuid) do contrato ali.';
comment on column contratos_gerados.assinatura_selfie_ref is 'Path no bucket privado contratos-selfies -- leitura só via signed URL gerada pelo backend, nunca URL pública.';

-- Tags customizadas por empresa, além do catálogo estático (TAGS_SISTEMA no código).
create table contrato_tags (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  nome_tag text not null,
  descricao text,
  criado_em timestamptz not null default now(),
  unique (empresa_id, nome_tag)
);

create index idx_contrato_tags_empresa on contrato_tags(empresa_id);

-- Registro histórico de aditivo -- nunca edita o contrato original nem a conta a receber
-- já existente. Se muda valor/parcelamento, a conta antiga é cancelada e uma nova é
-- criada (RegistrarAditivoUseCase), linkando os dois ids aqui pra rastreio.
create table contrato_aditivos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos_gerados(id),
  descricao text not null,
  valor_total_novo numeric(14, 2),
  numero_parcelas_novo integer,
  conta_receber_anterior_id uuid references contas_receber(id),
  conta_receber_nova_id uuid references contas_receber(id),
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now()
);

create index idx_contrato_aditivos_contrato on contrato_aditivos(contrato_id);

comment on table contrato_aditivos is 'Histórico de aditivos contratuais. Aditivo que só documenta mudança não-financeira (prazo, cláusula) não preenche as colunas de conta_receber.';

-- ============================================================
-- Documentos Societários
-- ============================================================

create table modelos_societarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  titulo text not null,
  conteudo_template text not null,
  tipo_documento text not null,
  tipo_conteudo text not null default 'html' check (tipo_conteudo in ('html', 'texto')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_modelos_societarios_empresa on modelos_societarios(empresa_id);

create trigger trg_modelos_societarios_atualizado_em before update on modelos_societarios
  for each row execute function set_atualizado_em();

-- Cláusulas de texto reutilizáveis, sem vínculo financeiro. Delete real permitido --
-- mesmo padrão de descricoes_extrato/identificadores_extrato (nada referencia essas
-- linhas via FK, é só apoio de composição do modelo/documento).
create table blocos_societarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  titulo text not null,
  conteudo text not null,
  tipo_bloco text,
  criado_em timestamptz not null default now()
);

create index idx_blocos_societarios_empresa on blocos_societarios(empresa_id);

create table documentos_societarios_gerados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  modelo_id uuid references modelos_societarios(id) on delete set null,
  cliente_id uuid references clientes(id),
  titulo text not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'finalizado', 'arquivado')),
  valores_tags jsonb not null default '{}',
  conteudo_renderizado text not null,
  conteudo_principal_manual text, -- cópia inicial editável (edição livre depois de gerado)
  data_registro date,
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_documentos_societarios_empresa on documentos_societarios_gerados(empresa_id);
create index idx_documentos_societarios_cliente on documentos_societarios_gerados(cliente_id);

create trigger trg_documentos_societarios_atualizado_em before update on documentos_societarios_gerados
  for each row execute function set_atualizado_em();

comment on column documentos_societarios_gerados.modelo_id is 'on delete set null -- diferente de contratos_gerados.modelo_id: documento societário não tem vínculo financeiro, então excluir o modelo não deve travar via FK, só desvincula.';

-- ============================================================
-- RLS -- mesmo padrão de clientes/protocolos (select = pode_acessar_empresa; insert/
-- update = auth_contador_id() da empresa dona; delete restrito por estado quando faz
-- sentido, real quando não há risco -- mesmo critério de historicos/descricoes_extrato
-- vs. protocolos/contas_receber).
-- ============================================================

alter table modelos_contrato enable row level security;
alter table configuracao_contratos enable row level security;
alter table contratos_gerados enable row level security;
alter table contrato_tags enable row level security;
alter table contrato_aditivos enable row level security;
alter table modelos_societarios enable row level security;
alter table blocos_societarios enable row level security;
alter table documentos_societarios_gerados enable row level security;

create policy modelos_contrato_select on modelos_contrato for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy modelos_contrato_insert on modelos_contrato for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy modelos_contrato_update on modelos_contrato for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy modelos_contrato_delete on modelos_contrato for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy configuracao_contratos_select on configuracao_contratos for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy configuracao_contratos_insert on configuracao_contratos for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy configuracao_contratos_update on configuracao_contratos for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy configuracao_contratos_delete on configuracao_contratos for delete to authenticated using (false);

create policy contratos_gerados_select on contratos_gerados for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy contratos_gerados_insert on contratos_gerados for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy contratos_gerados_update on contratos_gerados for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
-- Excluir só antes de qualquer assinatura (rascunho/pendente_assinatura) -- depois disso
-- é documento ativo/concluído/cancelado/bloqueado, nunca some via DELETE cru. A regra
-- fina (bloquear também se já tem recebimento) fica na Application (ExcluirContratoUseCase).
create policy contratos_gerados_delete on contratos_gerados for delete to authenticated
  using (
    (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
    and status in ('rascunho', 'pendente_assinatura')
  );

create policy contrato_tags_select on contrato_tags for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy contrato_tags_insert on contrato_tags for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy contrato_tags_update on contrato_tags for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy contrato_tags_delete on contrato_tags for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy contrato_aditivos_select on contrato_aditivos for select to authenticated
  using (exists (select 1 from contratos_gerados c where c.id = contrato_id and pode_acessar_empresa(c.empresa_id)));
create policy contrato_aditivos_insert on contrato_aditivos for insert to authenticated
  with check (
    exists (
      select 1 from contratos_gerados c
      where c.id = contrato_id
        and (eh_plataforma() or auth_contador_id() = (select contador_id from empresas e where e.id = c.empresa_id))
    )
  );
-- Aditivo é registro histórico -- nunca editado nem excluído depois de criado.
create policy contrato_aditivos_update on contrato_aditivos for update to authenticated using (false);
create policy contrato_aditivos_delete on contrato_aditivos for delete to authenticated using (false);

create policy modelos_societarios_select on modelos_societarios for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy modelos_societarios_insert on modelos_societarios for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy modelos_societarios_update on modelos_societarios for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy modelos_societarios_delete on modelos_societarios for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy blocos_societarios_select on blocos_societarios for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy blocos_societarios_insert on blocos_societarios for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy blocos_societarios_update on blocos_societarios for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy blocos_societarios_delete on blocos_societarios for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy documentos_societarios_select on documentos_societarios_gerados for select to authenticated using (pode_acessar_empresa(empresa_id));
create policy documentos_societarios_insert on documentos_societarios_gerados for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy documentos_societarios_update on documentos_societarios_gerados for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
-- Sem vínculo financeiro pra checar -- só o status (nunca excluir já finalizado/arquivado,
-- "arquivar" é a forma correta de encerrar um documento societário, não DELETE).
create policy documentos_societarios_delete on documentos_societarios_gerados for delete to authenticated
  using (
    (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
    and status = 'rascunho'
  );

-- Bucket privado -- upload/leitura só via backend (service_role), nunca direto do
-- browser, mesmo padrão de protocolos-anexos/mensagens-caixa-postal.
insert into storage.buckets (id, name, public)
values ('contratos-selfies', 'contratos-selfies', false)
on conflict (id) do nothing;

-- ============================================================
-- Catálogo de permissões
-- ============================================================

insert into permissoes (recurso, acao) values
  ('contratos', 'visualizar'), ('contratos', 'criar'), ('contratos', 'editar'), ('contratos', 'excluir'),
  ('documentos_societarios', 'visualizar'), ('documentos_societarios', 'criar'), ('documentos_societarios', 'editar'), ('documentos_societarios', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso in ('contratos', 'documentos_societarios')
on conflict do nothing;
