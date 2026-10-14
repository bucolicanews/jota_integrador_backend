import { Inject, Injectable } from '@nestjs/common';
import {
  CUSTOS_CONSULTAS_SERPRO_REPOSITORIO,
  CustosConsultasSerproRepositorioPort,
} from '../portas/custos-consultas-serpro-repositorio.port';

@Injectable()
export class RemoverCustoConsultaSerproUseCase {
  constructor(
    @Inject(CUSTOS_CONSULTAS_SERPRO_REPOSITORIO) private readonly repositorio: CustosConsultasSerproRepositorioPort,
  ) {}

  async executar(idSistema: string): Promise<void> {
    await this.repositorio.remover(idSistema);
  }
}
