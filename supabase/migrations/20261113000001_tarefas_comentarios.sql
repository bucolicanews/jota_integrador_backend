-- Comentários em tarefa -- só quem está ATRIBUÍDO à tarefa no momento pode comentar
-- (pedido explícito do usuário, 2026-11-13: "quando a tarefa está com ele"), não o
-- criador nem qualquer outro colega do quadro. Checagem replicada em dois níveis: RLS
-- aqui (rede de segurança) + Application layer (CriarComentarioTarefaUseCase, mensagem
-- de erro mais clara pro usuário). Leitura segue a mesma regra de posse de todo o
-- módulo (pode_acessar_empresa) -- comentar é restrito, ler não.

create table tarefas_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  autor_id uuid not null references usuarios(id),
  corpo text not null,
  criado_em timestamptz not null default now()
);

create index idx_tarefas_comentarios_tarefa on tarefas_comentarios(tarefa_id);

comment on table tarefas_comentarios is 'Comentários de uma tarefa -- só o usuário atribuído (tarefas.atribuido_a) no momento do comentário pode criar, qualquer um com acesso ao quadro pode ler.';

alter table tarefas_comentarios enable row level security;

create policy tarefas_comentarios_select on tarefas_comentarios for select to authenticated
  using (exists (select 1 from tarefas t where t.id = tarefa_id and pode_acessar_empresa(t.empresa_id)));

create policy tarefas_comentarios_insert on tarefas_comentarios for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (select 1 from tarefas t where t.id = tarefa_id and t.atribuido_a = auth.uid())
  );

-- Editar/excluir é só do próprio autor -- não acompanha o atribuido_a atual da tarefa
-- (reatribuir a tarefa pra outra pessoa não deveria apagar a autoria de quem comentou antes).
create policy tarefas_comentarios_update on tarefas_comentarios for update to authenticated
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

create policy tarefas_comentarios_delete on tarefas_comentarios for delete to authenticated
  using (autor_id = auth.uid());

-- Sem ação nova no catálogo de permissões: `acao` é enum fechado
-- (permissoes_acao_check: visualizar/criar/editar/excluir/bloquear), não vale a pena
-- alterar esse catálogo global só por este recurso. Comentar reaproveita
-- 'tarefas:editar' (já concedido a OPERADOR_CONTADOR/OPERADOR_EMPRESA pela migration do
-- módulo) como teto de capacidade -- a restrição REAL ("só quem está atribuído agora")
-- é por instância, imposta pelas policies insert/update/delete acima + pela Application
-- layer, não pelo RBAC genérico.
