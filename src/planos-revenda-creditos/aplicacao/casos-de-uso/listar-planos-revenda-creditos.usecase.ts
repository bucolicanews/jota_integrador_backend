import { Inject, Injectable } from '@nestjs/common';
import {
  PLANOS_REVENDA_CREDITOS_REPOSITORIO,
  PlanoRevendaCredito,
  PlanosRevendaCreditosRepositorioPort,
} from '../portas/planos-revenda-creditos-repositorio.port';

@Injectable()
export class ListarPlanosRevendaCreditosUseCase {
  constructor(
    @Inject(PLANOS_REVENDA_CREDITOS_REPOSITORIO) private readonly repositorio: PlanosRevendaCreditosRepositorioPort,
  ) {}

  async executar(contadorId: string): Promise<PlanoRevendaCredito[]> {
    return this.repositorio.listarPorContador(contadorId);
  }
}
