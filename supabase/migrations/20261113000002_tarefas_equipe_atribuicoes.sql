-- "Equipe da tarefa" (2026-11-13): conjunto de usuários candidatos a receber a tarefa,
-- distinto de tarefas.atribuido_a (quem está com ela AGORA). Dono da tarefa escolhe
-- livremente entre os membros da empresa/escritório -- não existe lista pré-configurada
-- no nível do quadro. Depois que a equipe tem pelo menos 1 membro, o botão "Atribuir"
-- (frontend) passa a oferecer só gente da equipe -- aplicado na Application layer, não
-- aqui (RLS não sabe dessa regra de produto).
create table tarefas_equipe (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id),
  adicionado_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now(),
  unique (tarefa_id, usuario_id)
);

create index idx_tarefas_equipe_tarefa on tarefas_equipe(tarefa_id);

comment on table tarefas_equipe is 'Candidatos a receber a tarefa (fila) -- todo membro da equipe vê o pipeline mesmo sem estar atribuído no momento.';

-- Histórico de reatribuição -- "Andre atribuiu a tarefa a Fulano" no feed. tarefas.atribuido_a
-- sozinho não guarda rastro (sobrescreve); esta tabela é o que falta pro pipeline completo.
create table tarefas_atribuicoes_historico (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  de_usuario_id uuid references usuarios(id),
  para_usuario_id uuid references usuarios(id),
  atribuido_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now()
);

create index idx_tarefas_atribuicoes_historico_tarefa on tarefas_atribuicoes_historico(tarefa_id);

comment on table tarefas_atribuicoes_historico is 'Toda troca de tarefas.atribuido_a, não só a última -- mesmo papel de tarefas_historico (movimentação de coluna), mas pra reatribuição.';

alter table tarefas_equipe enable row level security;
alter table tarefas_atribuicoes_historico enable row level security;

create policy tarefas_equipe_select on tarefas_equipe for select to authenticated
  using (exists (select 1 from tarefas t where t.id = tarefa_id and pode_acessar_empresa(t.empresa_id)));

-- Mesma autoridade de editar a tarefa (tarefas_update) -- quem já pode reatribuir via
-- PATCH .../:id também monta a equipe, não é restrito ao dono do quadro.
create policy tarefas_equipe_insert on tarefas_equipe for insert to authenticated
  with check (
    exists (
      select 1 from tarefas t
      where t.id = tarefa_id
        and (eh_plataforma() or auth_contador_id() = (select contador_id from empresas e where e.id = t.empresa_id))
    )
  );

create policy tarefas_equipe_delete on tarefas_equipe for delete to authenticated
  using (
    exists (
      select 1 from tarefas t
      where t.id = tarefa_id
        and (eh_plataforma() or auth_contador_id() = (select contador_id from empresas e where e.id = t.empresa_id))
    )
  );

-- Só leitura pra 'authenticated' -- escrita só pelo backend (service_role), mesmo padrão de tarefas_historico.
create policy tarefas_atribuicoes_historico_select on tarefas_atribuicoes_historico for select to authenticated
  using (exists (select 1 from tarefas t where t.id = tarefa_id and pode_acessar_empresa(t.empresa_id)));
