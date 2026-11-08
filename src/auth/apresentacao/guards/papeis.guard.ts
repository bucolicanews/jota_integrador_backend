import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Papel } from '../../dominio/papel';
import { CHAVE_PERMISSAO } from '../decorators/exigir-permissao.decorator';
import { CHAVE_PAPEIS } from '../decorators/papeis.decorator';
import { RequisicaoAutenticada } from '../tipos/requisicao-autenticada';

/**
 * Roda depois do SupabaseAuthGuard (precisa de `req.usuario` já populado).
 *
 * Fast-path literal (comportamento 100% inalterado pros 7 papéis de sistema): papel do
 * usuário bate com algum nome da lista -- passa, igual sempre foi.
 *
 * Fallback (só pra papel customizado, criado via /admin/papeis desde 2026-11-08): se o
 * literal não bateu, só deixa passar pro `PermissoesGuard` decidir de verdade quando a
 * MESMA rota também declara `@ExigirPermissao(...)` **e** o papel do usuário é de escopo
 * plataforma. Rota só com `@Papeis()` (sem `@ExigirPermissao`) continua 100% fechada pra
 * qualquer papel novo -- é onde vivem as ações exclusivas de papel de sistema (bloquear,
 * excluir, certificados, criar plano, conceder crédito). Nunca abre pra escopo
 * contador/empresa customizado (fora de escopo desta primeira versão).
 */
@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const papeisPermitidos = this.reflector.getAllAndOverride<Papel[] | undefined>(CHAVE_PAPEIS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!papeisPermitidos || papeisPermitidos.length === 0) {
      return true; // rota sem @Papeis(...) -- só exige autenticação, não papel específico
    }

    const requisicao = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (papeisPermitidos.includes(requisicao.usuario.papel)) {
      return true;
    }

    const exigePermissaoGranular = this.reflector.getAllAndOverride<string | undefined>(CHAVE_PERMISSAO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (exigePermissaoGranular && requisicao.usuario.escopo === 'plataforma') {
      return true; // PermissoesGuard (roda depois) exige a chave de fato
    }

    throw new ForbiddenException('Sem permissão para este recurso');
  }
}
