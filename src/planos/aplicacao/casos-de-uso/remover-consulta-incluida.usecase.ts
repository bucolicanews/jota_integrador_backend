import { Inject, Injectable } from '@nestjs/common';
import {
  PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO,
  PlanoConsultasIncluidasRepositorioPort,
} from '../portas/plano-consultas-incluidas-repositorio.port';

@Injectable()
export class RemoverConsultaIncluidaUseCase {
  constructor(
    @Inject(PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO) private readonly repositorio: PlanoConsultasIncluidasRepositorioPort,
  ) {}

  async executar(planoId: string, idSistema: string): Promise<void> {
    await this.repositorio.remover(planoId, idSistema.trim().toUpperCase());
  }
}
