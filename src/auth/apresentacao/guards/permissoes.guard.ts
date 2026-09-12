import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSOES_REPOSITORIO, PermissoesRepositorioPort } from '../../aplicacao/portas/permissoes-repositorio.port';
import { papelExigeChecagemGranular } from '../../dominio/permissao';
import { CHAVE_PERMISSAO } from '../decorators/exigir-permissao.decorator';
import { RequisicaoAutenticada } from '../tipos/requisicao-autenticada';

/** Roda depois do SupabaseAuthGuard (precisa de `req.usuario` já populado). */
@Injectable()
export class PermissoesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoes: PermissoesRepositorioPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const chave = this.reflector.getAllAndOverride<string | undefined>(CHAVE_PERMISSAO, [context.getHandler(), context.getClass()]);
    if (!chave) {
      return true; // rota sem @ExigirPermissao(...) -- essa camada não se aplica
    }

    const requisicao = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    const usuario = requisicao.usuario;

    if (!papelExigeChecagemGranular(usuario.papel)) {
      return true; // dono/plataforma nunca restrito por permissão granular
    }

    const permitido = await this.permissoes.usuarioTemPermissao(usuario.id, chave);
    if (!permitido) {
      throw new ForbiddenException(`Sem permissão "${chave}" concedida`);
    }
    return true;
  }
}
