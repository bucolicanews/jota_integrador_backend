import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { AGENTES_NOTAS_FISCAIS_REPOSITORIO, AgentesNotasFiscaisRepositorioPort } from '../portas/agentes-notas-fiscais-repositorio.port';

/**
 * Token de 32 bytes aleatórios -- só é mostrado em claro aqui, no retorno desta chamada;
 * depois disso só existe o hash (agentes_notas_fiscais.token_hash), nunca recuperável de
 * volta. Gerar um novo revoga o anterior automaticamente (AgentesNotasFiscaisRepositorioPort.criar).
 */
@Injectable()
export class GerarTokenAgenteUseCase {
  constructor(
    @Inject(AGENTES_NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: AgentesNotasFiscaisRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(empresaId: string, criadoPor: string): Promise<{ token: string }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.repositorio.criar(empresaId, tokenHash, criadoPor);

    await this.auditoria.registrar({
      usuarioId: criadoPor,
      empresaId,
      acao: 'GERAR_TOKEN_AGENTE_NOTAS_FISCAIS',
      recurso: `agentes_notas_fiscais:${empresaId}`,
    });

    return { token };
  }
}
