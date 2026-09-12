import { SetMetadata } from '@nestjs/common';

export const CHAVE_MODULO = 'modulo_exigido';

/**
 * Gate de licenciamento por pacote -- complementa @ExigirPermissao (que é RBAC, "o
 * usuário pode fazer X"), este é sobre "a EMPRESA tem direito a usar este módulo".
 * Uso: `@ExigirModulo('contratos')`. Resolvido via empresa_tem_modulo (RPC) --
 * empresas internas (contador/plataforma) e eh_plataforma() sempre passam.
 */
export const ExigirModulo = (modulo: string) => SetMetadata(CHAVE_MODULO, modulo);
