import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StorageContratosService } from '../../infraestrutura/storage-contratos.service';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

export interface UrlSelfie {
  url: string;
  expiraEmSegundos: number;
}

/** Autenticado -- contador/empresa vê a selfie depois, signed URL sob demanda (nunca cacheada, nunca pública). */
@Injectable()
export class ObterUrlSelfieUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    private readonly storage: StorageContratosService,
  ) {}

  async executar(id: string, empresaId: string): Promise<UrlSelfie> {
    const contrato = await this.repositorio.obterContratoPorId(id);
    if (!contrato || contrato.empresaId !== empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }
    if (!contrato.assinaturaSelfieRef) {
      throw new NotFoundException('Contrato ainda não tem selfie de assinatura');
    }
    return this.storage.gerarUrlAssinada(contrato.assinaturaSelfieRef);
  }
}
