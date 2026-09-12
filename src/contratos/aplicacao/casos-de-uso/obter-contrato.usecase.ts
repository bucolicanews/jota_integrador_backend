import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTRATOS_REPOSITORIO, ContratoAditivo, ContratoGerado, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

export interface ContratoComAditivos extends ContratoGerado {
  aditivos: ContratoAditivo[];
}

@Injectable()
export class ObterContratoUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<ContratoComAditivos> {
    const contrato = await this.repositorio.obterContratoPorId(id);
    if (!contrato || contrato.empresaId !== empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }
    const aditivos = await this.repositorio.listarAditivosPorContrato(id);
    return { ...contrato, aditivos };
  }
}
