import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NOTAS_FISCAIS_REPOSITORIO, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';
import { StorageNotasFiscaisService } from '../../infraestrutura/storage-notas-fiscais.service';

@Injectable()
export class ObterUrlXmlNotaFiscalUseCase {
  constructor(
    @Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: NotasFiscaisRepositorioPort,
    private readonly storage: StorageNotasFiscaisService,
  ) {}

  async executar(id: string, empresaId: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const nota = await this.repositorio.obterDetalhe(id, empresaId);
    if (!nota) throw new NotFoundException('Nota fiscal não encontrada');
    return this.storage.gerarUrlAssinada(nota.xmlStorageRef);
  }
}
