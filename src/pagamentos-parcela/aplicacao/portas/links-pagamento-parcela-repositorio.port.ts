import { StatusLinkPagamento } from '../../dominio/link-pagamento-parcela';

export interface LinkPagamentoParcela {
  id: string;
  parcelaId: string;
  empresaId: string;
  clienteId: string | null;
  valor: number;
  comissaoPct: number;
  comissaoValor: number;
  metodo: 'pix' | 'cartao';
  pagbankOrderId: string | null;
  pagbankChargeId: string | null;
  pixCode: string | null;
  pixQrUrl: string | null;
  recebimentoId: string | null;
  status: StatusLinkPagamento;
  criadoPor: string;
  criadoEm: string;
  pagoEm: string | null;
}

export interface DadosNovoLinkPagamento {
  parcelaId: string;
  empresaId: string;
  clienteId: string | null;
  valor: number;
  metodo: 'pix' | 'cartao';
  criadoPor: string;
}

export interface DadosConfirmacaoPagamento {
  status: StatusLinkPagamento;
  pagbankChargeId: string | null;
  recebimentoId: string | null;
  pagoEm: string | null;
}

export interface LinksPagamentoParcelaRepositorioPort {
  /** comissaoPct/comissaoValor vêm computados pelo trigger do banco (definir_comissao_link_pagamento_parcela) -- nunca calculados aqui. */
  criar(dados: DadosNovoLinkPagamento): Promise<LinkPagamentoParcela>;
  buscarPorId(id: string): Promise<LinkPagamentoParcela | null>;
  buscarPorPagbankOrderId(pagbankOrderId: string): Promise<LinkPagamentoParcela | null>;
  listarPorParcela(parcelaId: string): Promise<LinkPagamentoParcela[]>;
  /** Setado logo após criar a ordem na PagBank (síncrono, mesma chamada de `criar`). */
  definirDadosPix(id: string, dados: { pagbankOrderId: string; pixCode: string | null; pixQrUrl: string | null }): Promise<void>;
  /** Só chamado pelo webhook -- trigger `protege_campos_link_pagamento_parcela` no banco bloqueia isso vindo de contador/empresa comum. */
  confirmarPagamento(id: string, dados: DadosConfirmacaoPagamento): Promise<void>;
  marcarFalhou(id: string): Promise<void>;
}

export const LINKS_PAGAMENTO_PARCELA_REPOSITORIO = Symbol('LINKS_PAGAMENTO_PARCELA_REPOSITORIO');
