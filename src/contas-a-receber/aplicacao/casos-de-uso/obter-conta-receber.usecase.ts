import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTAS_RECEBER_REPOSITORIO, ContaReceber, ContasReceberRepositorioPort } from '../portas/contas-receber-repositorio.port';

@Injectable()
export class ObterContaReceberUseCase {
  constructor(@Inject(CONTAS_RECEBER_REPOSITORIO) private readonly repositorio: ContasReceberRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<ContaReceber> {
    const conta = await this.repositorio.obterPorId(id);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta a receber não encontrada');
    }
    return conta;
  }
}
