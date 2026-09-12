import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StorageProtocolosService } from '../../infraestrutura/storage-protocolos.service';
import { PROTOCOLOS_REPOSITORIO, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';

export interface UrlAnexo {
  url: string;
  expiraEmSegundos: number;
}

@Injectable()
export class ObterUrlAnexoUseCase {
  constructor(
    @Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort,
    private readonly storage: StorageProtocolosService,
  ) {}

  async executar(protocoloId: string, anexoId: string, empresaId: string): Promise<UrlAnexo> {
    const protocolo = await this.repositorio.obterPorId(protocoloId);
    if (!protocolo || protocolo.empresaId !== empresaId) {
      throw new NotFoundException('Protocolo não encontrado');
    }
    const anexo = await this.repositorio.obterAnexo(anexoId);
    if (!anexo || anexo.protocoloId !== protocoloId) {
      throw new NotFoundException('Anexo não encontrado');
    }
    return this.storage.gerarUrlAssinada(anexo.storageRef);
  }
}
