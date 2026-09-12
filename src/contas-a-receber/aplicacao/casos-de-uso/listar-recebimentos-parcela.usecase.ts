import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort, RecebimentoContaReceber } from '../portas/contas-receber-repositorio.port';

@Injectable()
export class ListarRecebimentosParcelaUseCase {
  constructor(@Inject(CONTAS_RECEBER_REPOSITORIO) private readonly repositorio: ContasReceberRepositorioPort) {}

  async executar(parcelaId: string, empresaId: string): Promise<RecebimentoContaReceber[]> {
    const parcela = await this.repositorio.obterParcela(parcelaId);
    if (!parcela || parcela.empresaId !== empresaId) {
      throw new NotFoundException('Parcela não encontrada');
    }
    return this.repositorio.listarRecebimentosDaParcela(parcelaId);
  }
}
