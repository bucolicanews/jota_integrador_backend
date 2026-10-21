import { Inject, Injectable } from '@nestjs/common';
import {
  ConsultaIncluidaPlano,
  PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO,
  PlanoConsultasIncluidasRepositorioPort,
} from '../portas/plano-consultas-incluidas-repositorio.port';

@Injectable()
export class ListarConsultasIncluidasUseCase {
  constructor(
    @Inject(PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO) private readonly repositorio: PlanoConsultasIncluidasRepositorioPort,
  ) {}

  async executar(planoId: string): Promise<ConsultaIncluidaPlano[]> {
    return this.repositorio.listarPorPlano(planoId);
  }
}
