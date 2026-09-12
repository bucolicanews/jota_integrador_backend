import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { TipoTransacaoExtrato } from '../../dominio/conciliacao';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort } from '../portas/conciliacao-repositorio.port';

export interface DadosConfirmarTransacoes {
  empresaId: string;
  usuarioId: string;
  /** Cada transação já precisa ter `contaContabilResultadoId` setado (via atualizar-conta-resultado, ou já veio sugerido pela regra). */
  transacaoIds: string[];
}

export interface FalhaConfirmacao {
  transacaoId: string;
  descricao: string;
  erro: string;
}

export interface ResultadoConfirmacao {
  quantidadeConciliadas: number;
  falhas: FalhaConfirmacao[];
}

/**
 * Cria um lançamento contábil por transação pendente escolhida (pode ser 1 -- triagem
 * da tela de Pendências -- ou várias de uma vez -- confirmação em lote do wizard).
 * Reusa a função atômica (via LANCAMENTOS_REPOSITORIO) que já valida partida dobrada --
 * nunca insert direto, mesmo princípio de sempre. Isso substitui os dois INSERTs soltos
 * com sinal invertido na mão que o jotaCaixa fazia (causa raiz do incidente de saldo
 * documentado lá).
 */
@Injectable()
export class ConfirmarTransacoesUseCase {
  constructor(
    @Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosConfirmarTransacoes): Promise<ResultadoConfirmacao> {
    if (dados.transacaoIds.length === 0) {
      throw new BadRequestException('Nenhuma transação selecionada para conciliar.');
    }

    const falhas: FalhaConfirmacao[] = [];
    let quantidadeConciliadas = 0;
    const regrasAprendidas: { descricaoExtrato: string; contaContabilId: string; tipoLancamento: TipoTransacaoExtrato }[] = [];

    for (const transacaoId of dados.transacaoIds) {
      const transacao = await this.repositorio.obterTransacao(transacaoId);

      if (!transacao || transacao.empresaId !== dados.empresaId) {
        falhas.push({ transacaoId, descricao: '(não encontrada)', erro: 'Transação não encontrada nesta empresa' });
        continue;
      }
      if (transacao.status !== 'pendente') {
        falhas.push({ transacaoId, descricao: transacao.descricao, erro: `Transação já está com status "${transacao.status}"` });
        continue;
      }
      if (!transacao.contaContabilResultadoId) {
        falhas.push({ transacaoId, descricao: transacao.descricao, erro: 'Nenhuma conta contábil escolhida pra contrapartida' });
        continue;
      }

      try {
        const partidaCaixa =
          transacao.tipo === 'Entrada'
            ? { contaId: transacao.contaContabilId, tipo: 'debito' as const, valor: transacao.valor }
            : { contaId: transacao.contaContabilId, tipo: 'credito' as const, valor: transacao.valor };
        const partidaResultado =
          transacao.tipo === 'Entrada'
            ? { contaId: transacao.contaContabilResultadoId, tipo: 'credito' as const, valor: transacao.valor }
            : { contaId: transacao.contaContabilResultadoId, tipo: 'debito' as const, valor: transacao.valor };

        const lancamentoId = await this.lancamentos.criar({
          empresaId: dados.empresaId,
          dataCompetencia: transacao.dataCompetencia,
          historico: transacao.descricao,
          documentoReferencia: transacao.identificacao,
          origem: 'conciliacao_bancaria',
          partidas: [partidaCaixa, partidaResultado],
          criadoPor: dados.usuarioId,
        });

        await this.repositorio.marcarConciliada(transacao.id, lancamentoId);

        quantidadeConciliadas += 1;
        regrasAprendidas.push({
          descricaoExtrato: transacao.descricao,
          contaContabilId: transacao.contaContabilResultadoId,
          tipoLancamento: transacao.tipo,
        });
      } catch (erro: unknown) {
        falhas.push({ transacaoId, descricao: transacao.descricao, erro: erro instanceof Error ? erro.message : String(erro) });
      }
    }

    if (regrasAprendidas.length > 0) {
      await this.repositorio.upsertRegras(dados.empresaId, regrasAprendidas);
    }

    await this.auditoria.registrar({
      usuarioId: dados.usuarioId,
      empresaId: dados.empresaId,
      acao: 'CONCILIAR_TRANSACOES_BANCARIAS',
      recurso: `conciliacao_transacoes:${dados.transacaoIds.join(',')}`,
      dadosNovos: { quantidadeConciliadas, quantidadeFalhas: falhas.length },
    });

    return { quantidadeConciliadas, falhas };
  }
}
