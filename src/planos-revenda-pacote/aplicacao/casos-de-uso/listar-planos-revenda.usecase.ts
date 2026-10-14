import { Inject, Injectable } from '@nestjs/common';
import {
  PLANOS_REVENDA_PACOTE_REPOSITORIO,
  PlanoRevendaPacote,
  PlanosRevendaPacoteRepositorioPort,
} from '../portas/planos-revenda-pacote-repositorio.port';

@Injectable()
export class ListarPlanosRevendaUseCase {
  constructor(
    @Inject(PLANOS_REVENDA_PACOTE_REPOSITORIO) private readonly repositorio: PlanosRevendaPacoteRepositorioPort,
  ) {}

  async executar(contadorId: string): Promise<PlanoRevendaPacote[]> {
    return this.repositorio.listarPorContador(contadorId);
  }
}
