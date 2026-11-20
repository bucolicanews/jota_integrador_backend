import { DirecaoNotaFiscal } from '../../../notas-fiscais/dominio/nota-fiscal';
import { NotaServicoExtraida, StatusNotaServico } from '../../dominio/nota-servico';

export interface NotaServicoResumo {
  id: string;
  empresaId: string;
  chaveAcesso: string;
  situacao: string;
  numeroNfse: string;
  dataProcessamento: string;
  dataEmissaoDps: string;
  direcao: DirecaoNotaFiscal;
  emitenteCnpj: string | null;
  emitenteCpf: string | null;
  emitenteNome: string;
  tomadorCnpj: string | null;
  tomadorCpf: string | null;
  tomadorNome: string | null;
  descricaoServico: string;
  codigoTributacaoNacional: string | null;
  valorLiquido: number;
  valorIssqn: number;
  valorBaseCalculo: number;
  status: StatusNotaServico;
  xmlStorageRef: string;
  motivoRejeicao: string | null;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  criadoEm: string;
}

export interface DadosNovaNotaServico {
  empresaId: string;
  extraida: NotaServicoExtraida;
  direcao: DirecaoNotaFiscal;
  xmlStorageRef: string;
}

export interface NotasServicoRepositorioPort {
  /** Idempotência checada antes (buscarPorChave) pelo caso de uso, não aqui -- mesmo princípio de NotasFiscaisRepositorioPort.criar. */
  criar(dados: DadosNovaNotaServico): Promise<string>;
  buscarPorChave(empresaId: string, chaveAcesso: string): Promise<NotaServicoResumo | null>;
  /** Fila de revisão -- só status='capturada'. */
  listarPendentes(empresaId: string): Promise<NotaServicoResumo[]>;
  /** Base do dashboard de acompanhamento (KPIs, tendência) -- qualquer status, filtrado por data de emissão do DPS. Mesmo princípio de NotasFiscaisRepositorioPort.listarPorPeriodo. */
  listarPorPeriodo(empresaId: string, dataInicio: string, dataFim: string): Promise<NotaServicoResumo[]>;
  obterDetalhe(id: string, empresaId: string): Promise<NotaServicoResumo | null>;
  marcarAprovada(id: string, aprovadoPor: string): Promise<void>;
  marcarRejeitada(id: string, motivoRejeicao: string): Promise<void>;
}

export const NOTAS_SERVICO_REPOSITORIO = Symbol('NOTAS_SERVICO_REPOSITORIO');
