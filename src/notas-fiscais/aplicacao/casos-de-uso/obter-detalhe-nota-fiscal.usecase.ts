import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NOTAS_FISCAIS_REPOSITORIO, NotaFiscalDetalhe, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';

@Injectable()
export class ObterDetalheNotaFiscalUseCase {
  constructor(@Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: NotasFiscaisRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<NotaFiscalDetalhe> {
    const nota = await this.repositorio.obterDetalhe(id, empresaId);
    if (!nota) throw new NotFoundException('Nota fiscal não encontrada');
    return nota;
  }
}
