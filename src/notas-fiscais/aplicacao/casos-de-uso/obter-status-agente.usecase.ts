import { Inject, Injectable } from '@nestjs/common';
import { AGENTES_NOTAS_FISCAIS_REPOSITORIO, AgenteNotasFiscais, AgentesNotasFiscaisRepositorioPort } from '../portas/agentes-notas-fiscais-repositorio.port';

@Injectable()
export class ObterStatusAgenteUseCase {
  constructor(@Inject(AGENTES_NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: AgentesNotasFiscaisRepositorioPort) {}

  async executar(empresaId: string): Promise<AgenteNotasFiscais | null> {
    return this.repositorio.buscarAtivoPorEmpresa(empresaId);
  }
}
