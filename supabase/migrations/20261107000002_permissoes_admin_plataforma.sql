-- Até agora `permissoes`/`papel_permissoes` só existiam pra OPERADOR_CONTADOR/
-- OPERADOR_EMPRESA (ver `papelExigeChecagemGranular`) -- ADMIN_FINANCEIRO/ADMIN_SUPORTE
-- nunca tinham nada pra assinalar em GerenciarUsuarios > Permissões (catálogo vazio).
-- Ainda não é enforcement real: nenhum endpoint de admin usa @ExigirPermissao com essas
-- chaves (confirmado -- todos os @ExigirPermissao existentes são de módulos de
-- operador/empresa). Isso só habilita o teto + o diálogo mostrar/gravar algo; o
-- MenuLateral já respeita (filtra os itens do menu), endpoints continuam só no @Papeis()
-- grosseiro de sempre.
insert into permissoes (recurso, acao) values
  ('contadores', 'visualizar'),
  ('empresas_todas', 'visualizar'),
  ('planos_credito', 'visualizar'),
  ('creditos_avulsos', 'visualizar'),
  ('configuracoes', 'visualizar'),
  ('folha_ponto', 'visualizar');

insert into papel_permissoes (papel_id, permissao_id)
select p.id, perm.id
from papeis p
cross join permissoes perm
where p.nome in ('ADMIN_FINANCEIRO', 'ADMIN_SUPORTE')
  and perm.recurso in ('contadores', 'empresas_todas', 'planos_credito', 'creditos_avulsos', 'configuracoes', 'folha_ponto')
  and perm.acao = 'visualizar';
