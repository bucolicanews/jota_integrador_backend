import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NOTAS_SERVICO_REPOSITORIO, NotaServicoResumo, NotasServicoRepositorioPort } from '../portas/notas-servico-repositorio.port';

@Injectable()
export class ObterDetalheNotaServicoUseCase {
  constructor(@Inject(NOTAS_SERVICO_REPOSITORIO) private readonly notasServicoRepositorio: NotasServicoRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<NotaServicoResumo> {
    const nota = await this.notasServicoRepositorio.obterDetalhe(id, empresaId);
    if (!nota) throw new NotFoundException('NFS-e não encontrada');
    return nota;
  }
}
