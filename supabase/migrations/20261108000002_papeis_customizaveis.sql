-- Papéis deixam de ser um catálogo fechado de 7 valores (decisão de 2026-09-06, revertida
-- aqui por pedido explícito do usuário em 2026-11-08) -- a tabela `papeis` já suportava N
-- linhas desde a migration 0002 (tinha até coluna `escopo` pronta), só o TS tratava como
-- enum fechado. Admin passa a poder criar papel novo pela UI (/admin/papeis), com
-- escopo+checklist de permissões próprio, usado como template pra `usuario_permissoes` na
-- criação de usuário (ver CriarUsuarioUseCase).
--
-- Duas colunas novas pra codificar, por linha, o que antes eram listas fixas em TS:
--   `sistema`         -- true só nos 7 originais; UI de papéis nunca deixa editar nome/
--                         escopo nem excluir linha com sistema=true.
--   `nunca_restringe` -- true só pra SUPER_ADMIN/CONTADOR_DONO/EMPRESARIO_DONO (dono não
--                         se autolimita, super admin já tem acesso total por definição).
--                         Todo papel novo nasce false (sempre passa por checagem granular
--                         de usuario_permissoes) -- default seguro, nunca escalona sozinho.

alter table papeis add column sistema boolean not null default false;
alter table papeis add column nunca_restringe boolean not null default false;

update papeis set sistema = true
where nome in ('SUPER_ADMIN', 'ADMIN_FINANCEIRO', 'ADMIN_SUPORTE', 'CONTADOR_DONO', 'OPERADOR_CONTADOR', 'EMPRESARIO_DONO', 'OPERADOR_EMPRESA');

update papeis set nunca_restringe = true
where nome in ('SUPER_ADMIN', 'CONTADOR_DONO', 'EMPRESARIO_DONO');

comment on table papeis is 'Catálogo de papéis (RBAC) -- os 7 originais (sistema=true) são fixos; a partir de 2026-11-08 admin (SUPER_ADMIN) pode criar papéis customizados (sistema=false) com escopo e checklist de permissões próprios, usados como template de usuario_permissoes na criação de usuário.';
comment on column papeis.sistema is 'true só nos 7 papéis originais -- nunca editável (nome/escopo) nem excluível pela UI de gestão de papéis.';
comment on column papeis.nunca_restringe is 'true = papel nunca é restringido por usuario_permissoes (dono/SUPER_ADMIN). false (default, inclusive todo papel novo) = sempre passa por checagem granular.';
