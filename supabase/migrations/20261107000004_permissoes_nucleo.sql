-- Itens do MenuLateral que eram "núcleo" (sempre visíveis, nem pra OPERADOR_CONTADOR/
-- OPERADOR_EMPRESA passavam por checagem granular) ganham `recurso` por pedido explícito
-- do usuário -- aceitando que isso também passa a restringir operador nesses itens (igual
-- qualquer outro recurso: ninguém tem até alguém conceder, mesmo padrão desde a migration
-- 20260911000002). Sugestões de Extrato/Mapeamento ganham recurso PRÓPRIO (não reaproveita
-- descricoes_extrato/identificadores_extrato) -- mapear pra um só dos dois escondia errado
-- (comentário original em MenuLateral.tsx).
insert into permissoes (recurso, acao) values
  ('carteira_empresas', 'visualizar'),
  ('auditoria', 'visualizar'),
  ('das', 'visualizar'),
  ('caixa_postal', 'visualizar'),
  ('configuracoes_fiscais', 'visualizar'),
  ('configuracoes_fiscais', 'editar'),
  ('mapeamento', 'visualizar'),
  ('mapeamento', 'editar'),
  ('lancamentos', 'visualizar'),
  ('lancamentos', 'criar'),
  ('lancamentos', 'editar'),
  ('lancamentos', 'excluir'),
  ('plano_contas', 'visualizar'),
  ('plano_contas', 'criar'),
  ('plano_contas', 'editar'),
  ('plano_contas', 'excluir'),
  ('sugestoes_extrato', 'visualizar'),
  ('sugestoes_extrato', 'criar'),
  ('sugestoes_extrato', 'editar'),
  ('sugestoes_extrato', 'excluir')
on conflict (recurso, acao) do nothing;

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('OPERADOR_CONTADOR', 'OPERADOR_EMPRESA', 'ADMIN_FINANCEIRO', 'ADMIN_SUPORTE')
  and perm.recurso in (
    'carteira_empresas', 'auditoria', 'das', 'caixa_postal', 'configuracoes_fiscais',
    'mapeamento', 'lancamentos', 'plano_contas', 'sugestoes_extrato'
  )
on conflict (papel_id, permissao_id) do nothing;
