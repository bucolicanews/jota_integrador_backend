import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PROTOCOLOS_REPOSITORIO, ProtocoloComAnexos, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';

@Injectable()
export class ObterProtocoloUseCase {
  constructor(@Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<ProtocoloComAnexos> {
    const protocolo = await this.repositorio.obterPorId(id);
    if (!protocolo || protocolo.empresaId !== empresaId) {
      throw new NotFoundException('Protocolo não encontrado');
    }
    const anexos = await this.repositorio.listarAnexos(id);
    return { ...protocolo, anexos };
  }
}
