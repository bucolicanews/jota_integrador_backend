import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AGENTES_NOTAS_FISCAIS_REPOSITORIO, AgentesNotasFiscaisRepositorioPort } from '../../aplicacao/portas/agentes-notas-fiscais-repositorio.port';
import { RequisicaoAgenteNf } from './requisicao-agente';

/**
 * Auth do agente local (máquina, não usuário humano) -- diferente de SupabaseAuthGuard,
 * não valida JWT nenhum, só compara o hash do Bearer contra agentes_notas_fiscais.token_hash
 * (mesmo princípio de hashCodigo2fa em usuarios.repositorio.supabase.ts: segredo de alta
 * entropia, hash simples sem salt é suficiente). Token nunca expira sozinho -- só é
 * invalidado por GerarTokenAgenteUseCase (substitui) ou RevogarTokenAgenteUseCase.
 */
@Injectable()
export class TokenAgenteGuard implements CanActivate {
  constructor(
    @Inject(AGENTES_NOTAS_FISCAIS_REPOSITORIO) private readonly agentesRepositorio: AgentesNotasFiscaisRepositorioPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requisicao = context.switchToHttp().getRequest<RequisicaoAgenteNf>();
    const token = this.extrairToken(requisicao);
    if (!token) {
      throw new UnauthorizedException('Token do agente ausente');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const agente = await this.agentesRepositorio.buscarPorTokenHash(tokenHash);
    if (!agente) {
      throw new UnauthorizedException('Token do agente inválido ou revogado');
    }

    requisicao.empresaIdAgente = agente.empresaId;
    // Best-effort -- não bloqueia a requisição se a atualização de "último uso" falhar.
    this.agentesRepositorio.marcarUltimoUso(agente.id).catch(() => undefined);
    return true;
  }

  private extrairToken(requisicao: RequisicaoAgenteNf): string | null {
    const cabecalho = requisicao.headers.authorization;
    if (!cabecalho?.startsWith('Bearer ')) return null;
    return cabecalho.slice('Bearer '.length).trim() || null;
  }
}
