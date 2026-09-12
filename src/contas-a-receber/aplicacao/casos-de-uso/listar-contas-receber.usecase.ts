import { Inject, Injectable } from '@nestjs/common';
import { CONTAS_RECEBER_REPOSITORIO, ContaReceber, ContasReceberRepositorioPort, FiltroContasReceber } from '../portas/contas-receber-repositorio.port';

@Injectable()
export class ListarContasReceberUseCase {
  constructor(@Inject(CONTAS_RECEBER_REPOSITORIO) private readonly repositorio: ContasReceberRepositorioPort) {}

  async executar(empresaId: string, filtro?: FiltroContasReceber): Promise<ContaReceber[]> {
    return this.repositorio.listarPorEmpresa(empresaId, filtro);
  }
}
