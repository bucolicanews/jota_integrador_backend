import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as Papa from 'papaparse';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { calcularHashConteudo, montarChaveTransacao, normalizarDescricao } from '../../dominio/conciliacao';
import { extrairTransacoes, LinhaExtratoBruta } from '../../dominio/parser-extrato';
import {
  CONCILIACAO_REPOSITORIO,
  ConciliacaoRepositorioPort,
  ImportacaoConciliacao,
  TransacaoConciliacao,
} from '../portas/conciliacao-repositorio.port';

export interface ResultadoPreVisualizacao {
  importacao: ImportacaoConciliacao;
  transacoes: TransacaoConciliacao[];
  /** true = arquivo já tinha sido processado antes (mesmo hash) -- devolvendo o que já estava salvo, não reprocessou. */
  retomada: boolean;
}

interface DadosPreVisualizacao {
  empresaId: string;
  contaContabilId: string;
  usuarioId: string;
  nomeArquivo: string;
  conteudoArquivo: string;
  mapeamento: { data: string; descricao: string; valor?: string | null; credito?: string | null; debito?: string | null; identificacao?: string | null };
  colunaTipoTransacao: string | null;
  valorCredito: string | null;
}

/**
 * Persiste TODA transação extraída do CSV desde este passo (não só a que for
 * confirmada depois) -- é o que permite a tela de Pendências (retomar depois) e o
 * Histórico real (ver plano). Idempotente por hash: reabrir o mesmo arquivo devolve o
 * que já foi salvo em vez de duplicar ou bloquear com erro.
 */
@Injectable()
export class PreVisualizarExtratoUseCase {
  constructor(
    @Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
  ) {}

  async executar(dados: DadosPreVisualizacao): Promise<ResultadoPreVisualizacao> {
    const conta = await this.planoContas.buscarPorId(dados.contaContabilId);
    if (!conta || conta.empresaId !== dados.empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (!conta.contaCaixaBanco) {
      throw new BadRequestException('A conta selecionada não está marcada como Caixa/Banco no plano de contas');
    }

    const hash = calcularHashConteudo(dados.conteudoArquivo);
    const importacaoExistente = await this.repositorio.obterImportacaoPorHash(dados.empresaId, dados.contaContabilId, hash);
    if (importacaoExistente) {
      const transacoes = await this.repositorio.listarTransacoesDaImportacao(importacaoExistente.id);
      return { importacao: importacaoExistente, transacoes, retomada: true };
    }

    const resultado = Papa.parse<LinhaExtratoBruta>(dados.conteudoArquivo, {
      header: true,
      skipEmptyLines: true,
      delimiter: '', // auto-detect (vírgula, ponto-e-vírgula, etc)
    });
    if (resultado.data.length === 0) {
      throw new BadRequestException('O arquivo está vazio ou não contém dados válidos.');
    }

    const extraidas = extrairTransacoes(resultado.data, dados.mapeamento, dados.colunaTipoTransacao, dados.valorCredito);
    if (extraidas.length === 0) {
      throw new BadRequestException('Nenhuma transação válida encontrada -- confira o mapeamento de colunas.');
    }

    const [chavesConciliadas, regras] = await Promise.all([
      this.repositorio.buscarChavesConciliadasExistentes(dados.empresaId, dados.contaContabilId),
      this.repositorio.listarRegras(dados.empresaId),
    ]);

    const importacao = await this.repositorio.criarImportacao({
      empresaId: dados.empresaId,
      contaContabilId: dados.contaContabilId,
      usuarioId: dados.usuarioId,
      nomeArquivo: dados.nomeArquivo,
      hash,
    });

    const novasTransacoes = extraidas.map((transacao) => {
      const descricaoNormalizada = normalizarDescricao(transacao.descricao);
      const chave = montarChaveTransacao(transacao.dataIso as string, descricaoNormalizada, transacao.valor, transacao.tipo);
      const duplicada = chavesConciliadas.has(chave);

      const regra = regras.find(
        (r) => r.tipoLancamento === transacao.tipo && descricaoNormalizada.includes(normalizarDescricao(r.descricaoExtrato)),
      );

      return {
        empresaId: dados.empresaId,
        contaContabilId: dados.contaContabilId,
        importacaoId: importacao.id,
        dataCompetencia: transacao.dataIso as string,
        descricao: transacao.descricao,
        valor: transacao.valor,
        tipo: transacao.tipo,
        identificacao: transacao.identificacao ?? null,
        chaveDedupe: chave,
        status: (duplicada ? 'duplicada' : 'pendente') as 'pendente' | 'duplicada',
        contaContabilResultadoId: duplicada ? null : (regra?.contaContabilId ?? null),
      };
    });

    const transacoesPersistidas = await this.repositorio.inserirTransacoes(novasTransacoes);
    const importacaoAtualizada = await this.repositorio.obterImportacao(importacao.id);

    return { importacao: importacaoAtualizada ?? importacao, transacoes: transacoesPersistidas, retomada: false };
  }
}
