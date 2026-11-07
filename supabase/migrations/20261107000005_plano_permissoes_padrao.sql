-- "Editar plano" unifica módulos (libera a empresa inteira) com um segundo conceito:
-- quais permissões (chave recurso:acao) o OPERADOR_EMPRESA de uma empresa nesse plano já
-- nasce com -- aplicado só na CRIAÇÃO do usuário (CriarUsuarioUseCase), nunca retroativo,
-- mesmo padrão de todo o resto do sistema de permissões. Nunca afeta OPERADOR_CONTADOR/
-- ADMIN_FINANCEIRO/ADMIN_SUPORTE (esses continuam só com o padrão fixo de 'suporte:visualizar').
alter table planos add column permissoes_padrao text[] not null default '{}';

comment on column planos.permissoes_padrao is 'Chaves (recurso:acao) concedidas automaticamente a todo OPERADOR_EMPRESA criado enquanto a empresa está neste plano -- não retroativo, não afeta outros papéis.';
