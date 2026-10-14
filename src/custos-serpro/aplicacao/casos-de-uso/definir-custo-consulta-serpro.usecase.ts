import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { validarCusto } from '../../dominio/custo-consulta-serpro';
import {
  CUSTOS_CONSULTAS_SERPRO_REPOSITORIO,
  CustoConsultaSerpro,
  CustosConsultasSerproRepositorioPort,
} from '../portas/custos-consultas-serpro-repositorio.port';

@Injectable()
export class DefinirCustoConsultaSerproUseCase {
  constructor(
    @Inject(CUSTOS_CONSULTAS_SERPRO_REPOSITORIO) private readonly repositorio: CustosConsultasSerproRepositorioPort,
  ) {}

  async executar(idSistema: string, custoReais: number): Promise<CustoConsultaSerpro> {
    try {
      validarCusto(custoReais);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }
    return this.repositorio.definir(idSistema, custoReais);
  }
}
