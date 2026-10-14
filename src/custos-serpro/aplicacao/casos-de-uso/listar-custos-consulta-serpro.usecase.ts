import { Inject, Injectable } from '@nestjs/common';
import {
  CUSTOS_CONSULTAS_SERPRO_REPOSITORIO,
  CustoConsultaSerpro,
  CustosConsultasSerproRepositorioPort,
} from '../portas/custos-consultas-serpro-repositorio.port';

@Injectable()
export class ListarCustosConsultaSerproUseCase {
  constructor(
    @Inject(CUSTOS_CONSULTAS_SERPRO_REPOSITORIO) private readonly repositorio: CustosConsultasSerproRepositorioPort,
  ) {}

  async executar(): Promise<CustoConsultaSerpro[]> {
    return this.repositorio.listar();
  }
}
