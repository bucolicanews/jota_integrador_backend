import { Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { AGENTES_NOTAS_FISCAIS_REPOSITORIO, AgentesNotasFiscaisRepositorioPort } from '../portas/agentes-notas-fiscais-repositorio.port';

@Injectable()
export class RevogarTokenAgenteUseCase {
  constructor(
    @Inject(AGENTES_NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: AgentesNotasFiscaisRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(empresaId: string, revogadoPor: string): Promise<void> {
    await this.repositorio.revogar(empresaId);
    await this.auditoria.registrar({
      usuarioId: revogadoPor,
      empresaId,
      acao: 'REVOGAR_TOKEN_AGENTE_NOTAS_FISCAIS',
      recurso: `agentes_notas_fiscais:${empresaId}`,
    });
  }
}
