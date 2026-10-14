export type StatusPagamentoAssinaturaCredito = 'pendente' | 'pago' | 'falhou';

export interface PagamentoAssinaturaCredito {
  id: string;
  contadorId: string;
  empresaId: string;
  planoId: string;
  planoRevendaId: string;
  valorTotal: number;
  platformAmount: number;
  sellerAmount: number;
  metodo: 'pix' | 'cartao';
  pagbankOrderId: string | null;
  pixCode: string | null;
  pixQrUrl: string | null;
  status: StatusPagamentoAssinaturaCredito;
}

export interface DadosNovoPagamentoAssinaturaCredito {
  contadorId: string;
  empresaId: string;
  planoId: string;
  planoRevendaId: string;
  valorTotal: number;
  platformAmount: number;
  sellerAmount: number;
  metodo: 'pix' | 'cartao';
}

export interface PagamentosAssinaturaCreditosRepositorioPort {
  criar(dados: DadosNovoPagamentoAssinaturaCredito): Promise<PagamentoAssinaturaCredito>;
  /** Evita 2 ordens PagBank concorrentes pra mesma empresa (mesma regra do índice único do banco). */
  obterPendentePorEmpresa(empresaId: string): Promise<PagamentoAssinaturaCredito | null>;
  obterPorPagbankOrderId(pagbankOrderId: string): Promise<PagamentoAssinaturaCredito | null>;
  definirDadosPix(id: string, dados: { pagbankOrderId: string; pixCode: string | null; pixQrUrl: string | null }): Promise<void>;
  marcarPago(id: string, pagbankChargeId: string | null): Promise<void>;
  marcarFalhou(id: string): Promise<void>;
}

export const PAGAMENTOS_ASSINATURA_CREDITOS_REPOSITORIO = Symbol('PAGAMENTOS_ASSINATURA_CREDITOS_REPOSITORIO');
