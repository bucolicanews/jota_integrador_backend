import { MapeamentoColunasExtrato, StatusTransacaoConciliacao, TipoTransacaoExtrato } from '../../dominio/conciliacao';

export interface ConfiguracaoConciliacao {
  id: string;
  empresaId: string;
  contaContabilId: string;
  nomeConfiguracao: string;
  mapeamento: MapeamentoColunasExtrato;
  colunaTipoTransacao: string | null;
  valorCredito: string | null;
  criadoEm: string;
}

export interface DadosConfiguracao {
  empresaId: string;
  contaContabilId: string;
  nomeConfiguracao: string;
  mapeamento: MapeamentoColunasExtrato;
  colunaTipoTransacao: string | null;
  valorCredito: string | null;
}

export interface RegraConciliacao {
  id: string;
  empresaId: string;
  descricaoExtrato: string;
  contaContabilId: string;
  tipoLancamento: TipoTransacaoExtrato;
}

export interface NovaRegra {
  descricaoExtrato: string;
  contaContabilId: string;
  tipoLancamento: TipoTransacaoExtrato;
}

export interface ImportacaoConciliacao {
  id: string;
  empresaId: string;
  contaContabilId: string;
  usuarioId: string;
  nomeArquivo: string;
  hash: string;
  criadoEm: string;
  totalPendentes: number;
  totalConciliadas: number;
  totalDuplicadas: number;
  totalIgnoradas: number;
}

export interface DadosNovaImportacao {
  empresaId: string;
  contaContabilId: string;
  usuarioId: string;
  nomeArquivo: string;
  hash: string;
}

export interface TransacaoConciliacao {
  id: string;
  empresaId: string;
  contaContabilId: string;
  importacaoId: string;
  dataCompetencia: string;
  descricao: string;
  valor: number;
  tipo: TipoTransacaoExtrato;
  identificacao: string | null;
  chaveDedupe: string;
  status: StatusTransacaoConciliacao;
  contaContabilResultadoId: string | null;
  lancamentoId: string | null;
  criadoEm: string;
}

export interface DadosNovaTransacao {
  empresaId: string;
  contaContabilId: string;
  importacaoId: string;
  dataCompetencia: string;
  descricao: string;
  valor: number;
  tipo: TipoTransacaoExtrato;
  identificacao: string | null;
  chaveDedupe: string;
  status: 'pendente' | 'duplicada';
  contaContabilResultadoId: string | null;
}

export interface FiltroTransacoes {
  contaContabilId?: string;
  status?: StatusTransacaoConciliacao;
}

export interface ConciliacaoRepositorioPort {
  criarConfiguracao(dados: DadosConfiguracao): Promise<ConfiguracaoConciliacao>;
  listarConfiguracoes(empresaId: string, contaContabilId?: string): Promise<ConfiguracaoConciliacao[]>;
  obterConfiguracao(id: string): Promise<ConfiguracaoConciliacao | null>;
  atualizarConfiguracao(id: string, dados: Partial<DadosConfiguracao>): Promise<void>;
  excluirConfiguracao(id: string): Promise<void>;

  listarRegras(empresaId: string): Promise<RegraConciliacao[]>;
  /** Upsert por (empresaId, descricaoExtrato, tipoLancamento) -- aprende/atualiza a regra. */
  upsertRegras(empresaId: string, regras: NovaRegra[]): Promise<void>;

  /** Importação com esse hash já existe pra essa conta? Preview usa isso pra retomar em vez de duplicar. */
  obterImportacaoPorHash(empresaId: string, contaContabilId: string, hash: string): Promise<ImportacaoConciliacao | null>;
  criarImportacao(dados: DadosNovaImportacao): Promise<ImportacaoConciliacao>;
  listarImportacoes(empresaId: string, contaContabilId?: string): Promise<ImportacaoConciliacao[]>;
  obterImportacao(id: string): Promise<ImportacaoConciliacao | null>;

  inserirTransacoes(transacoes: DadosNovaTransacao[]): Promise<TransacaoConciliacao[]>;
  listarTransacoesDaImportacao(importacaoId: string): Promise<TransacaoConciliacao[]>;
  /** Tela de Pendências -- todas as transações status='pendente' da empresa (opcionalmente filtrado por conta). */
  listarPorStatus(empresaId: string, filtro: FiltroTransacoes): Promise<TransacaoConciliacao[]>;
  obterTransacao(id: string): Promise<TransacaoConciliacao | null>;
  /** Chaves já CONCILIADAS pra essa conta -- dedupe linha-a-linha ao importar um período sobreposto. */
  buscarChavesConciliadasExistentes(empresaId: string, contaContabilId: string): Promise<Set<string>>;

  atualizarContaResultado(id: string, contaContabilResultadoId: string): Promise<void>;
  marcarConciliada(id: string, lancamentoId: string): Promise<void>;
  marcarIgnorada(id: string): Promise<void>;
}

export const CONCILIACAO_REPOSITORIO = Symbol('CONCILIACAO_REPOSITORIO');
