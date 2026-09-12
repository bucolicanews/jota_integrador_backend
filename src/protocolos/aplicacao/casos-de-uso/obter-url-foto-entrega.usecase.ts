import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StorageProtocolosService } from '../../infraestrutura/storage-protocolos.service';
import { PROTOCOLOS_REPOSITORIO, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';
import { UrlAnexo } from './obter-url-anexo.usecase';

@Injectable()
export class ObterUrlFotoEntregaUseCase {
  constructor(
    @Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort,
    private readonly storage: StorageProtocolosService,
  ) {}

  async executar(protocoloId: string, empresaId: string): Promise<UrlAnexo> {
    const protocolo = await this.repositorio.obterPorId(protocoloId);
    if (!protocolo || protocolo.empresaId !== empresaId) {
      throw new NotFoundException('Protocolo não encontrado');
    }
    if (!protocolo.imgProtocoloRef) {
      throw new BadRequestException('Este protocolo ainda não tem foto de entrega');
    }
    return this.storage.gerarUrlAssinada(protocolo.imgProtocoloRef);
  }
}
