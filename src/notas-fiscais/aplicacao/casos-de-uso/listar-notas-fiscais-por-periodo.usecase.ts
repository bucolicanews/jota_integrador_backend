import { Inject, Injectable } from '@nestjs/common';
import { NOTAS_FISCAIS_REPOSITORIO, NotaFiscalResumo, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';

/** Base de dados do dashboard de acompanhamento (KPIs, tendência diária, atividade recente) -- qualquer status, filtrado por data de emissão. */
@Injectable()
export class ListarNotasFiscaisPorPeriodoUseCase {
  constructor(@Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: NotasFiscaisRepositorioPort) {}

  async executar(empresaId: string, dataInicio: string, dataFim: string): Promise<NotaFiscalResumo[]> {
    return this.repositorio.listarPorPeriodo(empresaId, dataInicio, dataFim);
  }
}
