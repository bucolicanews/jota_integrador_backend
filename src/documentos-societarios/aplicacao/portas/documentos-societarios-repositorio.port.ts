import { StatusDocumentoSocietario } from '../../dominio/documento-societario';

export interface ModeloSocietario {
  id: string;
  empresaId: string;
  titulo: string;
  conteudoTemplate: string;
  tipoDocumento: string;
  tipoConteudo: 'html' | 'texto';
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosModeloSocietario {
  empresaId: string;
  titulo: string;
  conteudoTemplate: string;
  tipoDocumento: string;
  tipoConteudo: 'html' | 'texto';
}

export interface BlocoSocietario {
  id: string;
  empresaId: string;
  titulo: string;
  conteudo: string;
  tipoBloco: string | null;
  criadoEm: string;
}

export interface DadosBlocoSocietario {
  empresaId: string;
  titulo: string;
  conteudo: string;
  tipoBloco?: string | null;
}

export interface DocumentoSocietarioGerado {
  id: string;
  empresaId: string;
  modeloId: string | null;
  clienteId: string | null;
  titulo: string;
  status: StatusDocumentoSocietario;
  valoresTags: Record<string, string>;
  conteudoRenderizado: string;
  conteudoPrincipalManual: string | null;
  dataRegistro: string | null;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosNovoDocumentoSocietario {
  empresaId: string;
  modeloId: string | null;
  clienteId: string | null;
  titulo: string;
  valoresTags: Record<string, string>;
  conteudoRenderizado: string;
  dataRegistro: string | null;
  criadoPor: string;
}

export interface DadosAtualizarDocumentoSocietario {
  titulo?: string;
  conteudoPrincipalManual?: string | null;
  dataRegistro?: string | null;
}

export interface FiltroDocumentosSocietarios {
  status?: StatusDocumentoSocietario;
}

export interface DocumentosSocietariosRepositorioPort {
  criarModelo(dados: DadosModeloSocietario): Promise<ModeloSocietario>;
  listarModelosPorEmpresa(empresaId: string): Promise<ModeloSocietario[]>;
  obterModeloPorId(id: string): Promise<ModeloSocietario | null>;
  atualizarModelo(id: string, dados: Partial<DadosModeloSocietario>): Promise<void>;
  excluirModelo(id: string): Promise<void>;

  criarBloco(dados: DadosBlocoSocietario): Promise<BlocoSocietario>;
  listarBlocosPorEmpresa(empresaId: string): Promise<BlocoSocietario[]>;
  obterBlocoPorId(id: string): Promise<BlocoSocietario | null>;
  atualizarBloco(id: string, dados: Partial<DadosBlocoSocietario>): Promise<void>;
  excluirBloco(id: string): Promise<void>;

  criarDocumento(dados: DadosNovoDocumentoSocietario): Promise<DocumentoSocietarioGerado>;
  listarDocumentosPorEmpresa(empresaId: string, filtro?: FiltroDocumentosSocietarios): Promise<DocumentoSocietarioGerado[]>;
  obterDocumentoPorId(id: string): Promise<DocumentoSocietarioGerado | null>;
  atualizarDocumento(id: string, dados: DadosAtualizarDocumentoSocietario): Promise<void>;
  excluirDocumento(id: string): Promise<void>;
  marcarStatus(id: string, status: StatusDocumentoSocietario): Promise<void>;
}

export const DOCUMENTOS_SOCIETARIOS_REPOSITORIO = Symbol('DOCUMENTOS_SOCIETARIOS_REPOSITORIO');
