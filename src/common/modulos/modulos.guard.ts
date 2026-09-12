import { CanActivate, ExecutionContext, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { RequisicaoAutenticada } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { SupabaseService } from '../supabase/supabase.service';
import { CHAVE_MODULO } from './exigir-modulo.decorator';

/**
 * Roda depois de SupabaseAuthGuard (precisa de req.usuario) e depois de qualquer guard
 * que já tenha validado posse da empresa -- este guard só checa SE a empresa tem o
 * módulo, não SE o usuário pode acessar aquela empresa (isso já é feito pelo controller
 * via exigirPosse/exigirPosseDeContador, chamado ANTES do usecase, não no guard).
 *
 * Resolve empresaId sempre de `request.params.empresaId` -- convenção já usada em toda
 * rota gated (`empresas/:empresaId/...`). eh_plataforma() sempre passa (empresa_tem_modulo
 * já trata isso, mas checar aqui evita um RPC desnecessário nesse caso comum).
 */
@Injectable()
export class ModulosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const modulo = this.reflector.getAllAndOverride<string | undefined>(CHAVE_MODULO, [context.getHandler(), context.getClass()]);
    if (!modulo) {
      return true; // rota sem @ExigirModulo(...) -- núcleo contábil, sempre liberado
    }

    const requisicao = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (ehPapelDePlataforma(requisicao.usuario.papel)) {
      return true;
    }

    const empresaId = requisicao.params.empresaId;
    if (!empresaId) {
      throw new InternalServerErrorException('ModulosGuard usado numa rota sem :empresaId -- verificar @ExigirModulo só em controllers empresas/:empresaId/...');
    }

    const { data, error } = await this.supabase.admin.rpc('empresa_tem_modulo', { p_empresa_id: empresaId, p_modulo: modulo });
    if (error) {
      throw new InternalServerErrorException(`Falha ao checar módulo licenciado: ${error.message}`);
    }
    if (!data) {
      throw new ForbiddenException(`Esta empresa não tem o módulo "${modulo}" liberado no plano atual`);
    }

    return true;
  }
}
