import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort } from '../portas/conciliacao-repositorio.port';

/** Descarta uma transação pendente sem lançar -- ex: taxa/tarifa que não deve virar lançamento contábil. Nunca apaga a linha, só muda o status (rastreável no histórico). */
@Injectable()
export class IgnorarTransacaoUseCase {
  constructor(
    @Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(transacaoId: string, empresaId: string, usuarioId: string): Promise<void> {
    const transacao = await this.repositorio.obterTransacao(transacaoId);
    if (!transacao || transacao.empresaId !== empresaId) {
      throw new NotFoundException('Transação não encontrada');
    }
    if (transacao.status !== 'pendente') {
      throw new BadRequestException(`Transação já está com status "${transacao.status}"`);
    }

    await this.repositorio.marcarIgnorada(transacaoId);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'IGNORAR_TRANSACAO_CONCILIACAO',
      recurso: `conciliacao_transacoes:${transacaoId}`,
      dadosAntigos: { descricao: transacao.descricao, valor: transacao.valor },
    });
  }
}
