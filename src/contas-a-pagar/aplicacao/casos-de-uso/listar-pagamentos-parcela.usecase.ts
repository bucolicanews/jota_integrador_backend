import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTAS_PAGAR_REPOSITORIO, ContasPagarRepositorioPort, PagamentoContaPagar } from '../portas/contas-pagar-repositorio.port';

@Injectable()
export class ListarPagamentosParcelaUseCase {
  constructor(@Inject(CONTAS_PAGAR_REPOSITORIO) private readonly repositorio: ContasPagarRepositorioPort) {}

  async executar(parcelaId: string, empresaId: string): Promise<PagamentoContaPagar[]> {
    const parcela = await this.repositorio.obterParcela(parcelaId);
    if (!parcela || parcela.empresaId !== empresaId) {
      throw new NotFoundException('Parcela não encontrada');
    }
    return this.repositorio.listarPagamentosDaParcela(parcelaId);
  }
}
