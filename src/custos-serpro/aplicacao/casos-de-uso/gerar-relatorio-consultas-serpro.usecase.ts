import { Inject, Injectable } from '@nestjs/common';
import {
  FiltroRelatorioConsultas,
  LinhaRelatorioConsultas,
  RELATORIO_CONSULTAS_SERPRO_REPOSITORIO,
  RelatorioConsultasSerproRepositorioPort,
} from '../portas/relatorio-consultas-serpro-repositorio.port';

@Injectable()
export class GerarRelatorioConsultasSerproUseCase {
  constructor(
    @Inject(RELATORIO_CONSULTAS_SERPRO_REPOSITORIO)
    private readonly repositorio: RelatorioConsultasSerproRepositorioPort,
  ) {}

  async executar(filtro: FiltroRelatorioConsultas): Promise<LinhaRelatorioConsultas[]> {
    return this.repositorio.agregarPorFiltro(filtro);
  }
}
