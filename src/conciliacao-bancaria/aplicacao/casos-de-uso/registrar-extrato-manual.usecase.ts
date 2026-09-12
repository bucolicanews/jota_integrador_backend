import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { montarChaveTransacao, normalizarDescricao, TipoTransacaoExtrato } from '../../dominio/conciliacao';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort } from '../portas/conciliacao-repositorio.port';
import { ConfirmarTransacoesUseCase } from './confirmar-transacoes.usecase';

export interface DadosExtratoManual {
  empresaId: string;
  contaContabilId: string;
  contaContabilResultadoId: string;
  tipo: TipoTransacaoExtrato;
  valor: number;
  dataCompetencia: string;
  descricao: string;
  identificacao: string | null;
  usuarioId: string;
}

/**
 * Equivalente ao "Lançamento de Extrato Manual" do jotaCaixa (`FormExtratoDireto` --
 * registrar uma movimentação de caixa/banco sem ter importado um CSV, ex: PIX avulso,
 * tarifa bancária). Diferente de `FormMovimentacaoDireta` (Fluxo de Caixa) -- que já
 * existia e só cria o lançamento -- este fluxo TAMBÉM grava a transação em
 * `conciliacao_transacoes` já como "conciliada", igual a jotaCaixa grava em `extratos`.
 * Isso importa: se o usuário mais tarde importar um CSV cobrindo o mesmo período, a
 * `chaveDedupe` já bate e a importação reconhece essa linha como "duplicada" em vez de
 * lançar de novo (mesmo mecanismo de dedupe que já existe pra CSV, sem código novo).
 *
 * Cria uma "importação" sintética de 1 transação só (hash aleatório, nunca colide) e
 * reaproveita 100% `ConfirmarTransacoesUseCase` pra criar o lançamento -- não duplica a
 * lógica de partida dobrada nem a de auditoria/regras aprendidas.
 */
@Injectable()
export class RegistrarExtratoManualUseCase {
  constructor(
    @Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    private readonly confirmarTransacoes: ConfirmarTransacoesUseCase,
  ) {}

  async executar(dados: DadosExtratoManual) {
    if (dados.valor <= 0) {
      throw new BadRequestException('Valor precisa ser maior que zero');
    }

    const contaCaixaBanco = await this.planoContas.buscarPorId(dados.contaContabilId);
    if (!contaCaixaBanco || contaCaixaBanco.empresaId !== dados.empresaId) {
      throw new NotFoundException('Conta bancária não encontrada');
    }
    if (!contaCaixaBanco.contaCaixaBanco) {
      throw new BadRequestException('A conta selecionada não está marcada como "Caixa/Banco" no plano de contas');
    }

    const contaResultado = await this.planoContas.buscarPorId(dados.contaContabilResultadoId);
    if (!contaResultado || contaResultado.empresaId !== dados.empresaId) {
      throw new NotFoundException('Conta de contrapartida não encontrada');
    }
    if (contaResultado.sintetica) {
      throw new BadRequestException('Conta sintética não recebe lançamento direto -- selecione uma conta analítica');
    }

    const importacao = await this.repositorio.criarImportacao({
      empresaId: dados.empresaId,
      contaContabilId: dados.contaContabilId,
      usuarioId: dados.usuarioId,
      nomeArquivo: 'Lançamento manual',
      hash: randomUUID(),
    });

    const descricaoNormalizada = normalizarDescricao(dados.descricao);
    const chave = montarChaveTransacao(dados.dataCompetencia, descricaoNormalizada, dados.valor, dados.tipo);

    const [transacao] = await this.repositorio.inserirTransacoes([
      {
        empresaId: dados.empresaId,
        contaContabilId: dados.contaContabilId,
        importacaoId: importacao.id,
        dataCompetencia: dados.dataCompetencia,
        descricao: dados.descricao,
        valor: dados.valor,
        tipo: dados.tipo,
        identificacao: dados.identificacao,
        chaveDedupe: chave,
        status: 'pendente',
        contaContabilResultadoId: dados.contaContabilResultadoId,
      },
    ]);

    const resultado = await this.confirmarTransacoes.executar({
      empresaId: dados.empresaId,
      usuarioId: dados.usuarioId,
      transacaoIds: [transacao.id],
    });

    if (resultado.falhas.length > 0) {
      throw new BadRequestException(resultado.falhas[0].erro);
    }

    return this.repositorio.obterTransacao(transacao.id);
  }
}
