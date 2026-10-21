export type StatusPagamentoCreditoAvulso = 'pendente' | 'pago' | 'falhou';

export interface PagamentoCreditoAvulso {
  id: string;
  empresaId: string;
  pacoteId: string;
  valorTotal: number;
  pagbankOrderId: string | null;
  pixCode: string | null;
  pixQrUrl: string | null;
  status: StatusPagamentoCreditoAvulso;
}

export interface DadosNovoPagamentoCreditoAvulso {
  empresaId: string;
  pacoteId: string;
  valorTotal: number;
}

export interface PagamentosCreditosAvulsosRepositorioPort {
  criar(dados: DadosNovoPagamentoCreditoAvulso): Promise<PagamentoCreditoAvulso>;
  /** Evita 2 ordens PagBank concorrentes pra mesma empresa (mesma regra do índice único do banco). */
  obterPendentePorEmpresa(empresaId: string): Promise<PagamentoCreditoAvulso | null>;
  obterPorPagbankOrderId(pagbankOrderId: string): Promise<PagamentoCreditoAvulso | null>;
  definirDadosPix(id: string, dados: { pagbankOrderId: string; pixCode: string | null; pixQrUrl: string | null }): Promise<void>;
  marcarPago(id: string, pagbankChargeId: string | null): Promise<void>;
  marcarFalhou(id: string): Promise<void>;
}

export const PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO = Symbol('PAGAMENTOS_CREDITOS_AVULSOS_REPOSITORIO');
