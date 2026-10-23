export type StatusPagamentoCreditoAvulso = 'pendente' | 'pago' | 'falhou';

export interface PagamentoCreditoAvulso {
  id: string;
  empresaId: string;
  /** Null = compra em quantidade livre, sem pacote do catálogo. */
  pacoteId: string | null;
  /** Congelado no momento da ordem -- pacote.quantidadeCreditos ou quantidade livre digitada, sempre preenchido. */
  quantidadeCreditos: number;
  valorTotal: number;
  /** Preenchidos juntos só quando a compra passa pelo plano de revenda de um contador -- null = compra direta da plataforma, sem split. */
  contadorId: string | null;
  planoRevendaId: string | null;
  platformAmount: number | null;
  sellerAmount: number | null;
  pagbankOrderId: string | null;
  pixCode: string | null;
  pixQrUrl: string | null;
  status: StatusPagamentoCreditoAvulso;
}

export interface DadosNovoPagamentoCreditoAvulso {
  empresaId: string;
  pacoteId?: string | null;
  quantidadeCreditos: number;
  valorTotal: number;
  contadorId?: string | null;
  planoRevendaId?: string | null;
  platformAmount?: number | null;
  sellerAmount?: number | null;
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
