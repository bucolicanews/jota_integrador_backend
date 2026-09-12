import { Inject, Injectable } from '@nestjs/common';
import { HISTORICOS_REPOSITORIO, Historico, HistoricosRepositorioPort } from '../portas/historicos-repositorio.port';

@Injectable()
export class ListarHistoricosUseCase {
  constructor(@Inject(HISTORICOS_REPOSITORIO) private readonly repositorio: HistoricosRepositorioPort) {}

  async executar(empresaId: string): Promise<Historico[]> {
    return this.repositorio.listarPorEmpresa(empresaId);
  }
}
