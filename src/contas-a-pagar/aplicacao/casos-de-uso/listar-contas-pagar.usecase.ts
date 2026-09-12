import { Inject, Injectable } from '@nestjs/common';
import { CONTAS_PAGAR_REPOSITORIO, ContaPagar, ContasPagarRepositorioPort, FiltroContasPagar } from '../portas/contas-pagar-repositorio.port';

@Injectable()
export class ListarContasPagarUseCase {
  constructor(@Inject(CONTAS_PAGAR_REPOSITORIO) private readonly repositorio: ContasPagarRepositorioPort) {}

  async executar(empresaId: string, filtro?: FiltroContasPagar): Promise<ContaPagar[]> {
    return this.repositorio.listarPorEmpresa(empresaId, filtro);
  }
}
