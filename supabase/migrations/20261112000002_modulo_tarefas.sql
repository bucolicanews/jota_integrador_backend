-- Módulo Tarefas: quadro Kanban "bumerangue" -- N quadros por empresa (empresas.tipo
-- já unifica plataforma/escritório-do-contador/empresa-cliente, ver
-- 20260906000002_identidade_hierarquia.sql + 20261103000002_modulos_escritorio_contador.sql
-- -- então licenciamento/posse reaproveita empresa_tem_modulo/pode_acessar_empresa sem
-- nenhuma lógica nova de tenancy). Fluxo (colunas) é configurável pelo dono do quadro,
-- não um enum fechado como em protocolos.status. "Bumerangue": ao mover um card pra
-- coluna marcada eh_final, o backend (não esta migration) cria uma linha em
-- `notificacoes` pro criado_por da tarefa -- tarefas_historico guarda TODA
-- movimentação (+ quem ficou responsável naquele passo), pra ele acompanhar os passos
-- mesmo sem notificação em cada um.
--
-- Revisão 2026-11-12 (mesmo dia, pedido do usuário após ver a v1 funcionando): deixou de
-- ser 1 quadro fixo por empresa -- agora são N quadros (empresa escolhe em qual quadro
-- cada tarefa vive, pode mover tarefa de um quadro pra outro). Também ganhou tempo
-- estimado (horas), responsável por movimentação (não fixo por coluna) e anexos.

create table quadros_tarefas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  nome text not null,
  criado_em timestamptz not null default now()
);

create index idx_quadros_tarefas_empresa on quadros_tarefas(empresa_id);

comment on table quadros_tarefas is 'N quadros por empresa (empresas.tipo cobre plataforma/escritório-do-contador/cliente) -- ListarQuadrosUseCase auto-cria 1 quadro padrão só se a empresa ainda não tiver nenhum.';

create table colunas_tarefas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references quadros_tarefas(id) on delete cascade,
  nome text not null,
  ordem int not null,
  eh_final boolean not null default false,
  criado_em timestamptz not null default now()
);

create index idx_colunas_tarefas_quadro on colunas_tarefas(quadro_id);

comment on column colunas_tarefas.eh_final is 'Mover um card pra aqui dispara a notificação bumerangue pro criado_por da tarefa -- pode haver mais de 1 coluna final (ex: "Concluído" e "Cancelado").';

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  quadro_id uuid not null references quadros_tarefas(id),
  coluna_id uuid not null references colunas_tarefas(id),
  titulo text not null,
  descricao text,
  criado_por uuid not null references usuarios(id),
  atribuido_a uuid references usuarios(id),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  prazo date,
  tempo_estimado_horas numeric(6, 2),
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_tarefas_empresa on tarefas(empresa_id);
create index idx_tarefas_coluna on tarefas(coluna_id);
create index idx_tarefas_criado_por on tarefas(criado_por);

create trigger trg_tarefas_atualizado_em before update on tarefas
  for each row execute function set_atualizado_em();

create table tarefas_historico (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  coluna_origem_id uuid references colunas_tarefas(id),
  coluna_destino_id uuid not null references colunas_tarefas(id),
  movido_por uuid not null references usuarios(id),
  -- Quem ficou responsável NESSA etapa específica -- distinto de tarefas.atribuido_a
  -- (responsável geral da tarefa toda); pode mudar movimento a movimento, nunca fixo
  -- por coluna (pedido explícito 2026-11-12).
  responsavel_id uuid references usuarios(id),
  criado_em timestamptz not null default now()
);

create index idx_tarefas_historico_tarefa on tarefas_historico(tarefa_id);

comment on table tarefas_historico is 'Toda movimentação de coluna/quadro de uma tarefa, não só a última -- é o que deixa o criador ciente de cada passo mesmo quando o passo em si não dispara notificação (só a coluna eh_final dispara).';

create table tarefas_anexos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  nome_arquivo text not null,
  storage_ref text not null, -- path no bucket privado, nunca URL pública
  criado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now()
);

create index idx_tarefas_anexos_tarefa on tarefas_anexos(tarefa_id);

comment on table tarefas_anexos is 'Anexos de uma tarefa específica -- bucket privado, leitura só via signed URL gerada pelo backend (mesmo padrão de protocolos_anexos).';

-- Genérica (não prefixada tarefas_) de propósito -- outro módulo pode reaproveisar esta
-- tabela depois sem migration de rename. Insert só via backend (service_role, bypassa
-- RLS) -- nenhuma policy de insert pra 'authenticated' aqui, de propósito: usuário comum
-- nunca deveria conseguir criar notificação em nome do sistema.
create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id),
  tarefa_id uuid references tarefas(id) on delete cascade,
  mensagem text not null,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index idx_notificacoes_usuario on notificacoes(usuario_id, lida);

alter table quadros_tarefas enable row level security;
alter table colunas_tarefas enable row level security;
alter table tarefas enable row level security;
alter table tarefas_historico enable row level security;
alter table tarefas_anexos enable row level security;
alter table notificacoes enable row level security;

create policy quadros_tarefas_select on quadros_tarefas for select to authenticated
  using (pode_acessar_empresa(empresa_id));

create policy quadros_tarefas_insert on quadros_tarefas for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy quadros_tarefas_update on quadros_tarefas for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy quadros_tarefas_delete on quadros_tarefas for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy colunas_tarefas_select on colunas_tarefas for select to authenticated
  using (exists (select 1 from quadros_tarefas q where q.id = quadro_id and pode_acessar_empresa(q.empresa_id)));

-- Configurar coluna (criar/renomear/reordenar/excluir) é restrito à autoridade de
-- ESCRITA da empresa (dono do quadro), igual protocolos_insert/update -- nunca um
-- OPERADOR_CONTADOR/OPERADOR_EMPRESA comum, mesmo que ele tenha a permissão granular
-- tarefas:editar (essa permissão é só pra mover/editar CARD, não pra reconfigurar o quadro
-- -- checado na Application layer, RLS aqui é só rede de segurança).
create policy colunas_tarefas_insert on colunas_tarefas for insert to authenticated
  with check (
    exists (
      select 1 from quadros_tarefas q join empresas e on e.id = q.empresa_id
      where q.id = quadro_id and (eh_plataforma() or auth_contador_id() = e.contador_id)
    )
  );

create policy colunas_tarefas_update on colunas_tarefas for update to authenticated
  using (
    exists (
      select 1 from quadros_tarefas q join empresas e on e.id = q.empresa_id
      where q.id = quadro_id and (eh_plataforma() or auth_contador_id() = e.contador_id)
    )
  )
  with check (
    exists (
      select 1 from quadros_tarefas q join empresas e on e.id = q.empresa_id
      where q.id = quadro_id and (eh_plataforma() or auth_contador_id() = e.contador_id)
    )
  );

create policy colunas_tarefas_delete on colunas_tarefas for delete to authenticated
  using (
    exists (
      select 1 from quadros_tarefas q join empresas e on e.id = q.empresa_id
      where q.id = quadro_id and (eh_plataforma() or auth_contador_id() = e.contador_id)
    )
  );

create policy tarefas_select on tarefas for select to authenticated
  using (pode_acessar_empresa(empresa_id));

create policy tarefas_insert on tarefas for insert to authenticated
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy tarefas_update on tarefas for update to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id))
  with check (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy tarefas_delete on tarefas for delete to authenticated
  using (eh_plataforma() or auth_contador_id() = (select contador_id from empresas where id = empresa_id));

create policy tarefas_historico_select on tarefas_historico for select to authenticated
  using (exists (select 1 from tarefas t where t.id = tarefa_id and pode_acessar_empresa(t.empresa_id)));

create policy tarefas_anexos_select on tarefas_anexos for select to authenticated
  using (exists (select 1 from tarefas t where t.id = tarefa_id and pode_acessar_empresa(t.empresa_id)));

create policy tarefas_anexos_insert on tarefas_anexos for insert to authenticated
  with check (
    exists (
      select 1 from tarefas t
      where t.id = tarefa_id
        and (eh_plataforma() or auth_contador_id() = (select contador_id from empresas e where e.id = t.empresa_id))
    )
  );

-- Bucket privado -- upload/leitura só via backend (service_role), nunca direto do browser (mesmo padrão de protocolos-anexos).
insert into storage.buckets (id, name, public)
values ('tarefas-anexos', 'tarefas-anexos', false)
on conflict (id) do nothing;

create policy notificacoes_select on notificacoes for select to authenticated
  using (usuario_id = auth.uid());

create policy notificacoes_update on notificacoes for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

insert into permissoes (recurso, acao) values
  ('tarefas', 'visualizar'), ('tarefas', 'criar'), ('tarefas', 'editar'), ('tarefas', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA')
  and perm.recurso = 'tarefas'
on conflict do nothing;
