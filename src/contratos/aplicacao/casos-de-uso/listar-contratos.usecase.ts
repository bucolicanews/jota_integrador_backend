import { Inject, Injectable } from '@nestjs/common';
import { CONTRATOS_REPOSITORIO, ContratoGerado, ContratosRepositorioPort, FiltroContratos } from '../portas/contratos-repositorio.port';

@Injectable()
export class ListarContratosUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(empresaId: string, filtro?: FiltroContratos): Promise<ContratoGerado[]> {
    return this.repositorio.listarContratosPorEmpresa(empresaId, filtro);
  }
}
