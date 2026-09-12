import { StatusContrato } from '../../dominio/contrato';

export interface ModeloContrato {
  id: string;
  empresaId: string;
  titulo: string;
  conteudoTemplate: string;
  tipoConteudo: 'html' | 'texto';
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosModeloContrato {
  empresaId: string;
  titulo: string;
  conteudoTemplate: string;
  tipoConteudo: 'html' | 'texto';
}

export interface ContratoTag {
  id: string;
  empresaId: string;
  nomeTag: string;
  descricao: string | null;
}

export interface DadosContratoTag {
  empresaId: string;
  nomeTag: string;
  descricao?: string | null;
}

export interface ConfiguracaoContratos {
  empresaId: string;
  contaPatrimonialReceberId: string | null;
  contaResultadoReceitaId: string | null;
  urlBaseAssinatura: string | null;
}

export interface DadosConfiguracaoContratos {
  contaPatrimonialReceberId?: string | null;
  contaResultadoReceitaId?: string | null;
  urlBaseAssinatura?: string | null;
}

export interface ContratoGerado {
  id: string;
  empresaId: string;
  modeloId: string | null;
  clienteId: string;
  titulo: string;
  status: StatusContrato;
  valoresTags: Record<string, string>;
  conteudoRenderizado: string;
  valorTotal: number | null;
  contaReceberId: string | null;
  tokenAssinatura: string;
  assinaturaNome: string | null;
  assinaturaSelfieRef: string | null;
  assinadoEm: string | null;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosNovoContrato {
  empresaId: string;
  modeloId: string | null;
  clienteId: string;
  titulo: string;
  valoresTags: Record<string, string>;
  conteudoRenderizado: string;
  valorTotal: number | null;
  contaReceberId: string | null;
  criadoPor: string;
}

export interface DadosAtualizarContrato {
  titulo?: string;
  valoresTags?: Record<string, string>;
  conteudoRenderizado?: string;
  // Só usados por RegistrarAditivoUseCase quando o aditivo troca valor/parcelamento --
  // AtualizarContratoUseCase (edição livre de rascunho) nunca mexe nesses dois campos.
  valorTotal?: number | null;
  contaReceberId?: string | null;
}

export interface ContratoAditivo {
  id: string;
  contratoId: string;
  descricao: string;
  valorTotalNovo: number | null;
  numeroParcelasNovo: number | null;
  contaReceberAnteriorId: string | null;
  contaReceberNovaId: string | null;
  criadoPor: string;
  criadoEm: string;
}

export interface DadosNovoAditivo {
  contratoId: string;
  descricao: string;
  valorTotalNovo: number | null;
  numeroParcelasNovo: number | null;
  contaReceberAnteriorId: string | null;
  contaReceberNovaId: string | null;
  criadoPor: string;
}

export interface FiltroContratos {
  status?: StatusContrato;
}

export interface ContratosRepositorioPort {
  criarModelo(dados: DadosModeloContrato): Promise<ModeloContrato>;
  listarModelosPorEmpresa(empresaId: string): Promise<ModeloContrato[]>;
  obterModeloPorId(id: string): Promise<ModeloContrato | null>;
  atualizarModelo(id: string, dados: Partial<DadosModeloContrato>): Promise<void>;
  excluirModelo(id: string): Promise<void>;

  criarTag(dados: DadosContratoTag): Promise<ContratoTag>;
  listarTagsPorEmpresa(empresaId: string): Promise<ContratoTag[]>;
  excluirTag(id: string): Promise<void>;

  obterConfiguracao(empresaId: string): Promise<ConfiguracaoContratos | null>;
  salvarConfiguracao(empresaId: string, dados: DadosConfiguracaoContratos): Promise<ConfiguracaoContratos>;

  criarContrato(dados: DadosNovoContrato): Promise<ContratoGerado>;
  listarContratosPorEmpresa(empresaId: string, filtro?: FiltroContratos): Promise<ContratoGerado[]>;
  obterContratoPorId(id: string): Promise<ContratoGerado | null>;
  obterContratoPorToken(token: string): Promise<ContratoGerado | null>;
  atualizarContrato(id: string, dados: DadosAtualizarContrato): Promise<void>;
  excluirContrato(id: string): Promise<void>;
  marcarStatus(id: string, status: StatusContrato): Promise<void>;
  registrarAssinatura(id: string, dados: { assinaturaNome: string; assinaturaSelfieRef: string }): Promise<void>;

  criarAditivo(dados: DadosNovoAditivo): Promise<ContratoAditivo>;
  listarAditivosPorContrato(contratoId: string): Promise<ContratoAditivo[]>;
}

export const CONTRATOS_REPOSITORIO = Symbol('CONTRATOS_REPOSITORIO');
