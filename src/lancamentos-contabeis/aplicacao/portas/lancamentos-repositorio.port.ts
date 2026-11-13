import { OrigemLancamento, TipoPartida } from '../../dominio/lancamento';

export interface PartidaLancamento {
  id: string;
  contaId: string;
  tipo: TipoPartida;
  valor: number;
}

export interface LancamentoContabil {
  id: string;
  empresaId: string;
  dataCompetencia: string;
  historico: string;
  documentoReferencia: string | null;
  origem: OrigemLancamento;
  estornado: boolean;
  estornoDeId: string | null;
  editado: boolean;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
  criadoPor: string;
  criadoEm: string;
  /** true = lançamento de baixa (origem='das', via banco) ainda não casado com o extrato real na conciliação bancária. */
  pendenteConciliacao: boolean;
  partidas: PartidaLancamento[];
}

export interface DadosNovaPartida {
  contaId: string;
  tipo: TipoPartida;
  valor: number;
}

export interface DadosNovoLancamento {
  empresaId: string;
  dataCompetencia: string;
  historico: string;
  documentoReferencia: string | null;
  origem: OrigemLancamento;
  partidas: DadosNovaPartida[];
  criadoPor: string;
}

export interface FiltroLancamentos {
  dataInicio?: string;
  dataFim?: string;
  contaId?: string;
}

export interface DadosAtualizacaoLancamento {
  dataCompetencia: string;
  historico: string;
  partidas: DadosNovaPartida[];
}

export interface LancamentosRepositorioPort {
  /** Chama `criar_lancamento_contabil` no banco -- valida partida dobrada inteira numa transação só, lança erro se não fechar. */
  criar(dados: DadosNovoLancamento): Promise<string>;
  obterPorId(id: string): Promise<LancamentoContabil | null>;
  listarPorEmpresa(empresaId: string, filtro?: FiltroLancamentos): Promise<LancamentoContabil[]>;
  /** Chama `estornar_lancamento_contabil` -- cria o inverso, nunca edita/apaga o original. Retorna o id do novo lançamento (estorno). */
  estornar(id: string, motivo: string, executadoPorId: string): Promise<string>;
  /** Chama `atualizar_lancamento_contabil` -- edita cabeçalho+partidas de um lançamento já postado, mesma validação de partida dobrada de `criar`. Decisão explícita do usuário (ver comentário da migration). */
  atualizar(id: string, dados: DadosAtualizacaoLancamento, editadoPorId: string): Promise<void>;
  /** Saldo assinado da conta (positivo = a favor da natureza da conta), somando todas as partidas não estornadas até a data informada (ou até hoje). */
  obterSaldoConta(contaId: string, ateData?: string): Promise<number>;
  /**
   * true = existe lançamento de competência ainda em vigor pra este documento (origem
   * diferente de 'estorno' e não estornado). Usado por contas a receber/pagar e
   * contratos pra saber se o estorno de um lançamento deixou o documento "sem
   * lançamento" -- nunca conta o próprio lançamento de estorno como "ativo".
   */
  existeLancamentoAtivoParaDocumento(documentoReferencia: string): Promise<boolean>;
  /** Marca `pendente_conciliacao=true` -- update direto (não passa por `criar_lancamento_contabil`, é metadado, não afeta partida dobrada). */
  marcarPendenteConciliacao(id: string): Promise<void>;
}

export const LANCAMENTOS_REPOSITORIO = Symbol('LANCAMENTOS_REPOSITORIO');
