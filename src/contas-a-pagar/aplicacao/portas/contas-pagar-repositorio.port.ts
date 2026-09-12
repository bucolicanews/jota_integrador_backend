import { ModoParcelamento, StatusContaPagar } from '../../dominio/conta-pagar';

export interface ParcelaContaPagar {
  id: string;
  contaPagarId: string;
  empresaId: string;
  numeroParcela: number;
  valorParcela: number;
  dataVencimento: string;
  cancelada: boolean;
  valorPago: number;
  status: StatusContaPagar;
}

export interface ContaPagar {
  id: string;
  empresaId: string;
  fornecedorId: string | null;
  fornecedor: string;
  descricao: string;
  valorTotal: number;
  dataEmissao: string;
  contaPatrimonialId: string;
  contaResultadoId: string;
  cancelada: boolean;
  criadoPor: string;
  criadoEm: string;
  valorPago: number;
  status: StatusContaPagar;
  parcelas: ParcelaContaPagar[];
}

export interface DadosNovaContaPagar {
  empresaId: string;
  fornecedorId?: string | null;
  fornecedor: string;
  descricao: string;
  contaPatrimonialId: string;
  contaResultadoId: string;
  dataEmissao: string;
  criadoPor: string;
  modo: ModoParcelamento;
  valor: number;
  quantidadeParcelas: number;
  primeiroVencimento: string;
  intervaloDias: number;
}

export interface PagamentoContaPagar {
  id: string;
  parcelaId: string;
  empresaId: string;
  contaBancariaId: string;
  valorPago: number;
  dataPagamento: string;
  lancamentoId: string;
  estornado: boolean;
  criadoPor: string;
  criadoEm: string;
}

export interface DadosNovoPagamentoCP {
  parcelaId: string;
  empresaId: string;
  contaBancariaId: string;
  valorPago: number;
  dataPagamento: string;
  lancamentoId: string;
  criadoPor: string;
}

export interface FiltroContasPagar {
  status?: StatusContaPagar;
}

export interface ContasPagarRepositorioPort {
  criarComParcelas(dados: DadosNovaContaPagar): Promise<string>;
  listarPorEmpresa(empresaId: string, filtro?: FiltroContasPagar): Promise<ContaPagar[]>;
  obterPorId(id: string): Promise<ContaPagar | null>;
  cancelar(id: string): Promise<void>;

  obterParcela(id: string): Promise<ParcelaContaPagar | null>;

  criarPagamento(dados: DadosNovoPagamentoCP): Promise<PagamentoContaPagar>;
  listarPagamentosDaParcela(parcelaId: string): Promise<PagamentoContaPagar[]>;
  obterPagamento(id: string): Promise<PagamentoContaPagar | null>;
  marcarPagamentoEstornado(id: string): Promise<void>;
}

export const CONTAS_PAGAR_REPOSITORIO = Symbol('CONTAS_PAGAR_REPOSITORIO');
