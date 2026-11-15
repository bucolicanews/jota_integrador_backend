import { Inject, Injectable } from '@nestjs/common';
import { NOTAS_FISCAIS_REPOSITORIO, NotaFiscalResumo, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';

@Injectable()
export class ListarNotasFiscaisPendentesUseCase {
  constructor(@Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: NotasFiscaisRepositorioPort) {}

  async executar(empresaId: string): Promise<NotaFiscalResumo[]> {
    return this.repositorio.listarPendentes(empresaId);
  }
}
