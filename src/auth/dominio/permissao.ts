/**
 * Papéis "_DONO" e SUPER_ADMIN nunca são restringidos por permissão granular -- um dono
 * não se autolimita, e SUPER_ADMIN já tem acesso total por definição. Todo outro papel
 * (OPERADOR_CONTADOR/OPERADOR_EMPRESA/ADMIN_FINANCEIRO/ADMIN_SUPORTE, e qualquer papel
 * customizado criado via /admin/papeis) passa pela checagem em `usuario_permissoes` --
 * hoje afeta o que MenuLateral mostra/esconde, o catálogo de GerenciarUsuarios >
 * Permissões, e (desde 2026-11-08) algumas rotas `@ExigirPermissao` de leitura admin.
 *
 * `nuncaRestringe` vem da linha de `papeis.nunca_restringe` (migration 20261108000002) --
 * true só nos 3 papéis de sistema listados acima; todo papel novo nasce false (default
 * seguro, nunca escalona sozinho).
 */
export function papelExigeChecagemGranular(nuncaRestringe: boolean): boolean {
  return !nuncaRestringe;
}
