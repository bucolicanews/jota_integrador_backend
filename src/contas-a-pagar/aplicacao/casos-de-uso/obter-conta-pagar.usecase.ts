import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTAS_PAGAR_REPOSITORIO, ContaPagar, ContasPagarRepositorioPort } from '../portas/contas-pagar-repositorio.port';

@Injectable()
export class ObterContaPagarUseCase {
  constructor(@Inject(CONTAS_PAGAR_REPOSITORIO) private readonly repositorio: ContasPagarRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<ContaPagar> {
    const conta = await this.repositorio.obterPorId(id);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta a pagar não encontrada');
    }
    return conta;
  }
}
