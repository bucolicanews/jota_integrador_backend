import { Inject, Injectable } from '@nestjs/common';
import { NOTAS_SERVICO_REPOSITORIO, NotaServicoResumo, NotasServicoRepositorioPort } from '../portas/notas-servico-repositorio.port';

@Injectable()
export class ListarNotasServicoPendentesUseCase {
  constructor(@Inject(NOTAS_SERVICO_REPOSITORIO) private readonly notasServicoRepositorio: NotasServicoRepositorioPort) {}

  executar(empresaId: string): Promise<NotaServicoResumo[]> {
    return this.notasServicoRepositorio.listarPendentes(empresaId);
  }
}
