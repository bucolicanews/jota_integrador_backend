import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort } from '../portas/conciliacao-repositorio.port';

/** Deixa o usuário trocar a conta contábil de contrapartida sugerida antes de confirmar (triagem, tela de Pendências). */
@Injectable()
export class AtualizarContaResultadoUseCase {
  constructor(
    @Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
  ) {}

  async executar(transacaoId: string, empresaId: string, contaContabilResultadoId: string): Promise<void> {
    const transacao = await this.repositorio.obterTransacao(transacaoId);
    if (!transacao || transacao.empresaId !== empresaId) {
      throw new NotFoundException('Transação não encontrada');
    }
    if (transacao.status !== 'pendente') {
      throw new BadRequestException(`Transação já está com status "${transacao.status}", não pode mais ser editada`);
    }

    const conta = await this.planoContas.buscarPorId(contaContabilResultadoId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (conta.sintetica) {
      throw new BadRequestException('Conta sintética não recebe lançamento direto');
    }

    await this.repositorio.atualizarContaResultado(transacaoId, contaContabilResultadoId);
  }
}
