import { Inject, Injectable } from '@nestjs/common';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort, ModeloContrato } from '../portas/contratos-repositorio.port';

@Injectable()
export class ListarModelosContratoUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(empresaId: string): Promise<ModeloContrato[]> {
    return this.repositorio.listarModelosPorEmpresa(empresaId);
  }
}
