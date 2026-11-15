import { Injectable } from '@nestjs/common';
import { StorageNotasFiscaisService } from '../../infraestrutura/storage-notas-fiscais.service';

@Injectable()
export class ObterUrlDownloadAgenteUseCase {
  constructor(private readonly storage: StorageNotasFiscaisService) {}

  async executar(): Promise<{ url: string; expiraEmSegundos: number }> {
    return this.storage.gerarUrlDownloadAgente();
  }
}
