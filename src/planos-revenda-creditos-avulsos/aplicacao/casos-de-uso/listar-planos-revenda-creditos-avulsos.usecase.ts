import { Inject, Injectable } from '@nestjs/common';
import {
  PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO,
  PlanoRevendaCreditoAvulso,
  PlanosRevendaCreditosAvulsosRepositorioPort,
} from '../portas/planos-revenda-creditos-avulsos-repositorio.port';

@Injectable()
export class ListarPlanosRevendaCreditosAvulsosUseCase {
  constructor(
    @Inject(PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO) private readonly repositorio: PlanosRevendaCreditosAvulsosRepositorioPort,
  ) {}

  async executar(contadorId: string): Promise<PlanoRevendaCreditoAvulso[]> {
    return this.repositorio.listarPorContador(contadorId);
  }
}
