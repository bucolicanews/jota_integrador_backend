import { SetMetadata } from '@nestjs/common';

export const CHAVE_PERMISSAO = 'permissao_exigida';

/**
 * RBAC granular por usuário -- complementa `@Papeis()` (que só checa o papel). Só entra
 * em jogo pra papéis de funcionário (OPERADOR_CONTADOR/OPERADOR_EMPRESA); donos e
 * plataforma sempre passam (ver `papelExigeChecagemGranular`). Uso:
 * `@ExigirPermissao('conciliacao_bancaria:criar')`.
 */
export const ExigirPermissao = (chave: string) => SetMetadata(CHAVE_PERMISSAO, chave);
