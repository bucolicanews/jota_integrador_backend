export type StatusPagamentoAtivacaoLicenca = 'pendente' | 'pago' | 'falhou';

export interface PagamentoAtivacaoLicenca {
  id: string;
  licencaId: string;
  contadorId: string;
  empresaId: string;
  planoRevendaId: string;
  valorTotal: number;
  platformAmount: number;
  sellerAmount: number;
  metodo: 'pix' | 'cartao';
  pagbankOrderId: string | null;
  pixCode: string | null;
  pixQrUrl: string | null;
  status: StatusPagamentoAtivacaoLicenca;
}

export interface DadosNovoPagamentoAtivacao {
  licencaId: string;
  contadorId: string;
  empresaId: string;
  planoRevendaId: string;
  valorTotal: number;
  platformAmount: number;
  sellerAmount: number;
  metodo: 'pix' | 'cartao';
}

export interface PagamentosAtivacaoLicencaRepositorioPort {
  criar(dados: DadosNovoPagamentoAtivacao): Promise<PagamentoAtivacaoLicenca>;
  /** Evita 2 ordens PagBank concorrentes pra mesma licença (mesma regra do índice único do banco). */
  obterPendentePorLicenca(licencaId: string): Promise<PagamentoAtivacaoLicenca | null>;
  obterPorPagbankOrderId(pagbankOrderId: string): Promise<PagamentoAtivacaoLicenca | null>;
  definirDadosPix(id: string, dados: { pagbankOrderId: string; pixCode: string | null; pixQrUrl: string | null }): Promise<void>;
  marcarPago(id: string, pagbankChargeId: string | null): Promise<void>;
  marcarFalhou(id: string): Promise<void>;
  /** Pendências da empresa-cliente (tela "Pendências de ativação de módulo", lado JOTA FISCAL). */
  listarPendentesPorEmpresa(empresaId: string): Promise<PagamentoAtivacaoLicenca[]>;
}

export const PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO = Symbol('PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO');
