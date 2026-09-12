import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort, ModeloContrato } from '../portas/contratos-repositorio.port';

@Injectable()
export class ObterModeloContratoUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<ModeloContrato> {
    const modelo = await this.repositorio.obterModeloPorId(id);
    if (!modelo || modelo.empresaId !== empresaId) {
      throw new NotFoundException('Modelo de contrato não encontrado');
    }
    return modelo;
  }
}
