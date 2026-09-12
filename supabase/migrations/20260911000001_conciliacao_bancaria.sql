-- Conciliação bancária (#11), minerado a partir do jotaCaixa (projeto legado, só
-- leitura -- ver memória do usuário) -- mesma disciplina já aplicada ao módulo contábil
-- (migration 20260909000005): a versão nova corrige a falha estrutural real que o
-- jotaCaixa sofreu, não só copia o comportamento. Lá, salvar uma conciliação criava DOIS
-- lançamentos soltos via INSERT direto (Ativo + Resultado, sinal invertido na mão, sem
-- nada no banco garantindo que fechassem) -- exatamente a mesma classe de problema que
-- motivou `criar_lancamento_contabil`. Aqui a escrita da conciliação reusa essa função
-- (via LANCAMENTOS_REPOSITORIO na camada de aplicação, não SQL novo) -- só as tabelas de
-- apoio (configuração de importação, regras aprendidas, histórico de importação) são
-- novas neste módulo.
--
-- Escopo desta rodada (decisão explícita do usuário, 2026-09-11): só import de extrato
-- CSV + auto-conciliação por regra. O matching manual extrato<->parcela do jotaCaixa
-- (MapearExtratoDialog) fica de fora -- depende de um módulo de Contas a Pagar/Receber
-- que ainda não existe neste projeto. O caso especial de PagBank do jotaCaixa também
-- fica de fora -- é integração específica daquele projeto (PagBank), não existe aqui
-- (este projeto usa Stripe).

-- ============================================================
-- conciliacao_configuracoes: mapeamento de colunas do CSV por conta caixa/banco
-- ============================================================

create table conciliacao_configuracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  conta_contabil_id uuid not null references plano_contas(id),
  nome_configuracao text not null,
  -- {"data": "Data", "descricao": "Historico", "valor": "Valor", "identificacao":
  -- "Documento", "credito": null, "debito": null} -- mesmos dois modos do jotaCaixa
  -- (coluna de valor único com sinal, OU colunas de crédito/débito separadas).
  mapeamento jsonb not null,
  coluna_tipo_transacao text,
  valor_credito text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, conta_contabil_id, nome_configuracao)
);

create index idx_conciliacao_configuracoes_empresa on conciliacao_configuracoes(empresa_id);

create trigger trg_conciliacao_configuracoes_atualizado_em
  before update on conciliacao_configuracoes
  for each row execute function set_atualizado_em();

alter table conciliacao_configuracoes enable row level security;

create policy conciliacao_configuracoes_select on conciliacao_configuracoes for select to authenticated
  using (pode_acessar_empresa(empresa_id));

-- Mesmo critério de plano_contas: configurar importação é trabalho de escritório
-- contábil, não self-service da empresa-cliente.
create policy conciliacao_configuracoes_insert on conciliacao_configuracoes for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy conciliacao_configuracoes_update on conciliacao_configuracoes for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy conciliacao_configuracoes_delete on conciliacao_configuracoes for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

comment on table conciliacao_configuracoes is 'Mapeamento de colunas do CSV de extrato bancário, salvo por conta caixa/banco para reuso em importações futuras.';

-- ============================================================
-- conciliacao_regras: aprendidas a cada conciliação confirmada, reusadas na próxima
-- ============================================================

create table conciliacao_regras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  -- Descrição já normalizada (sem acento, minúscula) na hora de gravar -- o match na
  -- aplicação também normaliza a descrição da transação antes de comparar.
  descricao_extrato text not null,
  conta_contabil_id uuid not null references plano_contas(id),
  tipo_lancamento text not null check (tipo_lancamento in ('Entrada', 'Saida')),
  criado_em timestamptz not null default now(),
  unique (empresa_id, descricao_extrato, tipo_lancamento)
);

create index idx_conciliacao_regras_empresa on conciliacao_regras(empresa_id);

alter table conciliacao_regras enable row level security;

create policy conciliacao_regras_select on conciliacao_regras for select to authenticated
  using (pode_acessar_empresa(empresa_id));
create policy conciliacao_regras_insert on conciliacao_regras for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy conciliacao_regras_update on conciliacao_regras for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy conciliacao_regras_delete on conciliacao_regras for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

comment on table conciliacao_regras is 'Regra aprendida: descrição do extrato (normalizada) -> conta contábil, por tipo Entrada/Saida. Sugerida automaticamente nas próximas importações.';

-- ============================================================
-- conciliacao_importacoes: histórico + bloqueio de reimportação do mesmo arquivo
-- ============================================================

create table conciliacao_importacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  conta_contabil_id uuid not null references plano_contas(id),
  usuario_id uuid not null references usuarios(id),
  nome_arquivo text not null,
  -- Hash SHA-256 do conteúdo do arquivo -- mesmo mecanismo de bloqueio por hash do
  -- jotaCaixa, evita reimportar o mesmo extrato duas vezes por engano.
  extrato_hash text not null,
  quantidade_conciliadas integer not null default 0,
  quantidade_rejeitadas integer not null default 0,
  criado_em timestamptz not null default now(),
  unique (empresa_id, conta_contabil_id, extrato_hash)
);

create index idx_conciliacao_importacoes_empresa on conciliacao_importacoes(empresa_id);

alter table conciliacao_importacoes enable row level security;

create policy conciliacao_importacoes_select on conciliacao_importacoes for select to authenticated
  using (pode_acessar_empresa(empresa_id));
create policy conciliacao_importacoes_insert on conciliacao_importacoes for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
-- Histórico de importação é imutável -- mesmo princípio de lancamentos_contabeis (nunca
-- UPDATE/DELETE, é rastro de auditoria de quando/quem importou o quê).
create policy conciliacao_importacoes_update on conciliacao_importacoes for update to authenticated using (false);
create policy conciliacao_importacoes_delete on conciliacao_importacoes for delete to authenticated using (false);

comment on table conciliacao_importacoes is 'Histórico imutável de importações de extrato -- bloqueia reimportar o mesmo arquivo (hash) na mesma conta.';
