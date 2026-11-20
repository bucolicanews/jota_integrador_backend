import { Inject, Injectable } from '@nestjs/common';
import { NOTAS_SERVICO_REPOSITORIO, NotaServicoResumo, NotasServicoRepositorioPort } from '../portas/notas-servico-repositorio.port';

/** Base do dashboard de acompanhamento (KPIs, tendência) -- qualquer status, filtrado por data de emissão do DPS. Mesmo princípio de ListarNotasFiscaisPorPeriodoUseCase. */
@Injectable()
export class ListarNotasServicoPorPeriodoUseCase {
  constructor(@Inject(NOTAS_SERVICO_REPOSITORIO) private readonly repositorio: NotasServicoRepositorioPort) {}

  async executar(empresaId: string, dataInicio: string, dataFim: string): Promise<NotaServicoResumo[]> {
    return this.repositorio.listarPorPeriodo(empresaId, dataInicio, dataFim);
  }
}
