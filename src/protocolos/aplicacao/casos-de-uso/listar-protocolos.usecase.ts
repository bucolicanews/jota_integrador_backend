import { Inject, Injectable } from '@nestjs/common';
import { FiltroProtocolos, PROTOCOLOS_REPOSITORIO, Protocolo, ProtocolosRepositorioPort } from '../portas/protocolos-repositorio.port';

@Injectable()
export class ListarProtocolosUseCase {
  constructor(@Inject(PROTOCOLOS_REPOSITORIO) private readonly repositorio: ProtocolosRepositorioPort) {}

  async executar(empresaId: string, filtro?: FiltroProtocolos): Promise<Protocolo[]> {
    return this.repositorio.listarPorEmpresa(empresaId, filtro);
  }
}
