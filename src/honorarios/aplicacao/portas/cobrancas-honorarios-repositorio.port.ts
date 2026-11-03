import { StatusCobranca } from '../../dominio/cobranca-honorario';

export interface CobrancaHonorario {
  id: string;
  contadorId: string;
  empresaId: string;
  descricao: string;
  valor: number;
  comissaoPct: number;
  comissaoValor: number;
  metodo: 'pix' | 'cartao' | null;
  pagbankOrderId: string | null;
  pagbankChargeId: string | null;
  pixCode: string | null;
  pixQrUrl: string | null;
  status: StatusCobranca;
  criadoEm: string;
  pagoEm: string | null;
}

export interface DadosNovaCobranca {
  contadorId: string;
  empresaId: string;
  descricao: string;
  valor: number;
  metodo: 'pix' | 'cartao';
}

export interface DadosAtualizacaoPagamento {
  status: StatusCobranca;
  pagbankChargeId: string | null;
  pagoEm: string | null;
}

export interface CobrancasHonorariosRepositorioPort {
  /** comissaoPct/comissaoValor vêm computados pelo trigger do banco (definir_comissao_honorario) -- nunca calculados aqui. */
  criar(dados: DadosNovaCobranca): Promise<CobrancaHonorario>;
  buscarPorId(id: string): Promise<CobrancaHonorario | null>;
  buscarPorPagbankOrderId(pagbankOrderId: string): Promise<CobrancaHonorario | null>;
  listarPorContador(contadorId: string): Promise<CobrancaHonorario[]>;
  listarPorEmpresa(empresaId: string): Promise<CobrancaHonorario[]>;
  /** Setado logo após criar a ordem na PagBank (síncrono, mesma chamada de `criar`). */
  definirDadosPix(id: string, dados: { pagbankOrderId: string; pixCode: string | null; pixQrUrl: string | null }): Promise<void>;
  /** Só chamado pelo webhook -- trigger `protege_campos_cobranca_honorario` no banco bloqueia isso vindo de contador comum. */
  atualizarPagamento(id: string, dados: DadosAtualizacaoPagamento): Promise<void>;
  marcarFalhou(id: string): Promise<void>;
}

export const COBRANCAS_HONORARIOS_REPOSITORIO = Symbol('COBRANCAS_HONORARIOS_REPOSITORIO');
