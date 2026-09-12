import { ModoParcelamento, StatusContaReceber } from '../../dominio/conta-receber';

export interface ParcelaContaReceber {
  id: string;
  contaReceberId: string;
  empresaId: string;
  numeroParcela: number;
  valorParcela: number;
  dataVencimento: string;
  cancelada: boolean;
  valorRecebido: number;
  status: StatusContaReceber;
}

export interface ContaReceber {
  id: string;
  empresaId: string;
  clienteId: string | null;
  clienteNome: string;
  descricao: string;
  valorTotal: number;
  dataEmissao: string;
  contaPatrimonialId: string;
  contaResultadoId: string;
  cancelada: boolean;
  criadoPor: string;
  criadoEm: string;
  valorRecebido: number;
  status: StatusContaReceber;
  parcelas: ParcelaContaReceber[];
}

export interface DadosNovaContaReceber {
  empresaId: string;
  clienteId?: string | null;
  clienteNome: string;
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

export interface RecebimentoContaReceber {
  id: string;
  parcelaId: string;
  empresaId: string;
  contaBancariaId: string;
  valorRecebido: number;
  dataRecebimento: string;
  lancamentoId: string;
  estornado: boolean;
  criadoPor: string;
  criadoEm: string;
}

export interface DadosNovoRecebimento {
  parcelaId: string;
  empresaId: string;
  contaBancariaId: string;
  valorRecebido: number;
  dataRecebimento: string;
  lancamentoId: string;
  criadoPor: string;
}

export interface FiltroContasReceber {
  status?: StatusContaReceber;
}

export interface ContasReceberRepositorioPort {
  criarComParcelas(dados: DadosNovaContaReceber): Promise<string>;
  listarPorEmpresa(empresaId: string, filtro?: FiltroContasReceber): Promise<ContaReceber[]>;
  obterPorId(id: string): Promise<ContaReceber | null>;
  cancelar(id: string): Promise<void>;

  obterParcela(id: string): Promise<ParcelaContaReceber | null>;

  criarRecebimento(dados: DadosNovoRecebimento): Promise<RecebimentoContaReceber>;
  listarRecebimentosDaParcela(parcelaId: string): Promise<RecebimentoContaReceber[]>;
  obterRecebimento(id: string): Promise<RecebimentoContaReceber | null>;
  marcarRecebimentoEstornado(id: string): Promise<void>;
}

export const CONTAS_RECEBER_REPOSITORIO = Symbol('CONTAS_RECEBER_REPOSITORIO');
