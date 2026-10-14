import { CallHandler, ExecutionContext, ForbiddenException, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Papel } from '../../../auth/dominio/papel';
import { RequisicaoAutenticada } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort } from '../../aplicacao/portas/assinaturas-repositorio.port';

const PAPEIS_EMPRESA: Papel[] = [Papel.EMPRESARIO_DONO, Papel.OPERADOR_EMPRESA];

/**
 * Gate GLOBAL de acesso (2026-10-14): sem assinatura de créditos ATIVA, a empresa-cliente
 * não acessa NADA da plataforma (contratos, documentos societários, SERPRO, etc.) -- não é
 * só a restrição pontual de débito de crédito que já existia em ConsultarCcmeiUseCase/
 * caixa-postal (essa continua, defesa em profundidade).
 *
 * Registrado globalmente (APP_INTERCEPTOR, app.module.ts) em vez de em cada controller
 * `empresas/:empresaId/*` (são ~20) -- interceptors globais sempre rodam DEPOIS de todos
 * os guards (locais e globais) já terem passado, então `request.usuario` já está
 * populado pelo SupabaseAuthGuard de cada controller, mesmo sem relação de import entre
 * eles e este interceptor.
 *
 * Detecta rota de empresa pelo PATH real (`/empresas/<id>/...`), não pelo nome do
 * `:param` -- o nome do parâmetro não é consistente entre controllers (`EmpresasController`
 * usa `:id` pra `/empresas/:id`, outros usam `:empresaId` pra `/empresas/:empresaId/...`);
 * ler o segmento de URL em si funciona pra qualquer um dos dois sem precisar enumerar
 * cada convenção. Rotas que não começam com `/empresas/` (`/auth/me`, `/planos`,
 * `/webhooks/...`, `/contadores/.../empresas/.../assinatura`) nunca são afetadas. Papéis
 * de contador/plataforma nunca são bloqueados aqui (precisam continuar acessando a
 * própria empresa mesmo bloqueada, pra poder reativar/cobrar de novo).
 */
@Injectable()
export class AssinaturaAtivaInterceptor implements NestInterceptor {
  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const requisicao = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    const usuario = requisicao.usuario;

    if (!usuario || !PAPEIS_EMPRESA.includes(usuario.papel)) {
      return next.handle();
    }

    const segmentos = requisicao.path.split('/').filter(Boolean);
    const empresaId = segmentos[0] === 'empresas' ? segmentos[1] : undefined;
    if (!empresaId || empresaId !== usuario.empresaId) {
      // Rota não é /empresas/<id>/... (ex: /auth/me) -- sempre libera. empresaId
      // diferente do próprio -- não é esse interceptor que decide (guard de posse já rejeita).
      return next.handle();
    }

    const assinatura = await this.assinaturasRepositorio.buscarAtivaPorEmpresa(empresaId);
    if (!assinatura) {
      throw new ForbiddenException('Sua empresa está sem plano ativo -- contate seu contador pra liberar o acesso.');
    }

    return next.handle();
  }
}
