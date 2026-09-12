import { StatusProtocolo } from '../../dominio/protocolo';

export interface AnexoProtocolo {
  id: string;
  protocoloId: string;
  nomeArquivo: string;
  storageRef: string;
  criadoEm: string;
}

export interface Protocolo {
  id: string;
  empresaId: string;
  clienteId: string;
  numeroProtocolo: string;
  titulo: string;
  descricao: string | null;
  linkTarefa: string | null;
  status: StatusProtocolo;
  nomeRespRecebimento: string | null;
  imgProtocoloRef: string | null;
  observacaoStatus: string | null;
  dataCriacao: string;
  dataImpressao: string | null;
  dataRecebimento: string | null;
  criadoPor: string;
  usuarioCriadorNome: string | null;
  criadoEm: string;
}

export interface ProtocoloComAnexos extends Protocolo {
  anexos: AnexoProtocolo[];
}

export interface DadosNovoProtocolo {
  empresaId: string;
  clienteId: string;
  numeroProtocolo: string;
  titulo: string;
  descricao: string | null;
  linkTarefa: string | null;
  criadoPor: string;
  usuarioCriadorNome: string | null;
}

export interface DadosAtualizarProtocolo {
  clienteId?: string;
  titulo?: string;
  descricao?: string | null;
  linkTarefa?: string | null;
}

export interface FiltroProtocolos {
  status?: StatusProtocolo;
}

export interface ProtocolosRepositorioPort {
  criar(dados: DadosNovoProtocolo): Promise<Protocolo>;
  listarPorEmpresa(empresaId: string, filtro?: FiltroProtocolos): Promise<Protocolo[]>;
  obterPorId(id: string): Promise<Protocolo | null>;
  atualizar(id: string, dados: DadosAtualizarProtocolo): Promise<void>;
  excluir(id: string): Promise<void>;

  avancarStatus(id: string, novoStatus: StatusProtocolo, dataEfeito: { dataImpressao?: string }): Promise<void>;
  registrarEntrega(id: string, dados: { nomeRespRecebimento: string; dataRecebimento: string; imgProtocoloRef: string }): Promise<void>;
  cancelarOuMarcarProblema(id: string, status: 'cancelado' | 'problema', observacaoStatus: string): Promise<void>;

  adicionarAnexo(protocoloId: string, nomeArquivo: string, storageRef: string): Promise<AnexoProtocolo>;
  listarAnexos(protocoloId: string): Promise<AnexoProtocolo[]>;
  obterAnexo(id: string): Promise<AnexoProtocolo | null>;
}

export const PROTOCOLOS_REPOSITORIO = Symbol('PROTOCOLOS_REPOSITORIO');
