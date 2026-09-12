-- Correção de rumo (2026-09-11, mesma sessão): a primeira versão de conciliação
-- bancária só persistia o que era CONFIRMADO (preview efêmero, nunca salvo) -- não dava
-- pra ter Histórico real nem uma tela de "Pendências" (triagem pós-import, equivalente
-- a `Mapeamento.tsx` do jotaCaixa). Esta migration persiste TODA transação extraída do
-- CSV desde o preview, com status, permitindo retomar depois.
--
-- Também adiciona o mecanismo genérico de permissão granular por usuário
-- (`usuario_permissoes`) -- as tabelas `papeis`/`permissoes`/`papel_permissoes` já
-- existem desde a migration 0002 mas nunca foram ligadas ao código (grep confirmou zero
-- uso). Papéis "_DONO" e de plataforma nunca são restringidos (dono não se autolimita);
-- só papéis de funcionário (OPERADOR_CONTADOR, OPERADOR_EMPRESA) passam pela checagem.

-- ============================================================
-- conciliacao_importacoes: remove contadores desnormalizados (agora derivados de
-- conciliacao_transacoes.status, nunca podem divergir da realidade)
-- ============================================================

alter table conciliacao_importacoes drop column if exists quantidade_conciliadas;
alter table conciliacao_importacoes drop column if exists quantidade_rejeitadas;

-- ============================================================
-- conciliacao_transacoes: toda linha extraída do CSV, com status -- não só o que foi
-- confirmado. Idempotente por hash: reabrir o preview do mesmo arquivo devolve as
-- transações já persistidas em vez de duplicar.
-- ============================================================

create table conciliacao_transacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  conta_contabil_id uuid not null references plano_contas(id),
  importacao_id uuid not null references conciliacao_importacoes(id),
  data_competencia date not null,
  descricao text not null,
  valor numeric(14, 2) not null check (valor > 0),
  tipo text not null check (tipo in ('Entrada', 'Saida')),
  identificacao text,
  -- Chave de dedupe (data|descrição normalizada|valor|tipo) -- usada tanto pra marcar
  -- 'duplicada' no preview quanto indexada pra busca rápida em importações futuras.
  chave_dedupe text not null,
  status text not null check (status in ('pendente', 'conciliada', 'duplicada', 'ignorada')) default 'pendente',
  -- Sugestão (via regra aprendida) ou escolha final do usuário -- mesma coluna, o
  -- preview já popula com a sugestão, confirmar só valida que não ficou nula.
  conta_contabil_resultado_id uuid references plano_contas(id),
  -- Preenchido só quando status = 'conciliada' -- aponta pro lançamento real criado via
  -- criar_lancamento_contabil (nunca inserido direto, mesmo princípio de sempre).
  lancamento_id uuid references lancamentos_contabeis(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_conciliacao_transacoes_empresa on conciliacao_transacoes(empresa_id);
create index idx_conciliacao_transacoes_importacao on conciliacao_transacoes(importacao_id);
create index idx_conciliacao_transacoes_conta_status on conciliacao_transacoes(conta_contabil_id, status);
create index idx_conciliacao_transacoes_chave on conciliacao_transacoes(conta_contabil_id, chave_dedupe) where status = 'conciliada';

create trigger trg_conciliacao_transacoes_atualizado_em
  before update on conciliacao_transacoes
  for each row execute function set_atualizado_em();

alter table conciliacao_transacoes enable row level security;

create policy conciliacao_transacoes_select on conciliacao_transacoes for select to authenticated
  using (pode_acessar_empresa(empresa_id));
create policy conciliacao_transacoes_insert on conciliacao_transacoes for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy conciliacao_transacoes_update on conciliacao_transacoes for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));
create policy conciliacao_transacoes_delete on conciliacao_transacoes for delete to authenticated using (false);

comment on table conciliacao_transacoes is 'Toda transação extraída de um extrato importado, com status de triagem (pendente/conciliada/duplicada/ignorada) -- persistido desde o preview, não só na confirmação, pra permitir retomar depois (tela de Pendências).';

-- ============================================================
-- usuario_permissoes: concessão granular por usuário, camada acima de papel_permissoes
-- ============================================================

create table usuario_permissoes (
  usuario_id uuid not null references usuarios(id),
  permissao_id uuid not null references permissoes(id),
  concedido_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  primary key (usuario_id, permissao_id)
);

alter table usuario_permissoes enable row level security;

-- Leitura: o próprio usuário vê as próprias permissões; quem tem autoridade sobre ele
-- (contador dono do escritório, dono da PRÓPRIA empresa, contador dono da empresa que
-- emprega o funcionário, ou plataforma) também vê.
create policy usuario_permissoes_select on usuario_permissoes for select to authenticated
  using (
    usuario_id = auth.uid()
    or eh_plataforma()
    or auth_contador_id() = (select contador_id from usuarios where id = usuario_id)
    or auth_empresa_id() = (select empresa_id from usuarios where id = usuario_id)
    or (select empresa_id from usuarios where id = usuario_id) in (
      select id from empresas where contador_id = auth_contador_id()
    )
  );

-- Escrita: só quem tem autoridade (nunca o próprio usuário se autoconcede).
create policy usuario_permissoes_insert on usuario_permissoes for insert to authenticated
  with check (
    eh_plataforma()
    or auth_contador_id() = (select contador_id from usuarios where id = usuario_id)
    or auth_empresa_id() = (select empresa_id from usuarios where id = usuario_id)
  );
create policy usuario_permissoes_delete on usuario_permissoes for delete to authenticated
  using (
    eh_plataforma()
    or auth_contador_id() = (select contador_id from usuarios where id = usuario_id)
    or auth_empresa_id() = (select empresa_id from usuarios where id = usuario_id)
  );
create policy usuario_permissoes_update on usuario_permissoes for update to authenticated using (false);

comment on table usuario_permissoes is 'Concessão explícita de permissão por usuário -- só relevante pra papéis de funcionário (OPERADOR_CONTADOR/OPERADOR_EMPRESA); papéis "_DONO" e de plataforma nunca são restringidos por aqui, sempre passam.';

-- ============================================================
-- Primeiro catálogo real de `permissoes`/`papel_permissoes` -- ambas as tabelas
-- existiam desde a migration 0002 mas nunca tinham nenhuma linha (só o catálogo de
-- `papeis` era populado). `papel_permissoes` funciona como TETO (quais permissões
-- fazem sentido pro escopo daquele papel) -- a concessão de fato pro funcionário
-- específico continua exigindo uma linha em `usuario_permissoes` também.
-- ============================================================

insert into permissoes (recurso, acao) values
  ('conciliacao_bancaria', 'visualizar'),
  ('conciliacao_bancaria', 'criar'),
  ('conciliacao_bancaria', 'editar'),
  ('conciliacao_bancaria', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'conciliacao_bancaria'
on conflict do nothing;
