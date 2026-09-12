import { Inject, Injectable } from '@nestjs/common';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort, DadosModeloContrato, ModeloContrato } from '../portas/contratos-repositorio.port';

@Injectable()
export class CriarModeloContratoUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(dados: DadosModeloContrato): Promise<ModeloContrato> {
    return this.repositorio.criarModelo(dados);
  }
}
