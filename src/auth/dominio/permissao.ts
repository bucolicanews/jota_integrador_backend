import { Papel } from './papel';

/**
 * Papéis "_DONO" e SUPER_ADMIN nunca são restringidos por permissão granular -- um dono
 * não se autolimita, e SUPER_ADMIN já tem acesso total por definição. OPERADOR_CONTADOR/
 * OPERADOR_EMPRESA (funcionário) e ADMIN_FINANCEIRO/ADMIN_SUPORTE (admin de plataforma,
 * mas não o dono) passam pela checagem em `usuario_permissoes` -- hoje só afeta o que
 * MenuLateral mostra/esconde e o catálogo de GerenciarUsuarios > Permissões; nenhum
 * endpoint usa `@ExigirPermissao` com os recursos de admin ainda (ver migration
 * 20261107000002), então não há enforcement real na API por trás disso.
 */
export function papelExigeChecagemGranular(papel: Papel): boolean {
  return (
    papel === Papel.OPERADOR_CONTADOR ||
    papel === Papel.OPERADOR_EMPRESA ||
    papel === Papel.ADMIN_FINANCEIRO ||
    papel === Papel.ADMIN_SUPORTE
  );
}
