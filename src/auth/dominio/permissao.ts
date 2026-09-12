import { Papel } from './papel';

/**
 * Papéis "_DONO" e de plataforma nunca são restringidos por permissão granular -- um
 * dono não se autolimita, e plataforma já passa pelo `@Papeis()` grosseiro. Só papéis de
 * funcionário (escopo contador/empresa, sem ser o dono) passam pela checagem em
 * `usuario_permissoes`.
 */
export function papelExigeChecagemGranular(papel: Papel): boolean {
  return papel === Papel.OPERADOR_CONTADOR || papel === Papel.OPERADOR_EMPRESA;
}
