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
  contaPatrimonialPagarId: string | null; // usado quando esta empresa é a CONTRAPARTE (devedora) de um contrato de outra
  contaResultadoDespesaId: string | null;
  urlBaseAssinatura: string | null;
}

export interface DadosConfiguracaoContratos {
  contaPatrimonialReceberId?: string | null;
  contaResultadoReceitaId?: string | null;
  contaPatrimonialPagarId?: string | null;
  contaResultadoDespesaId?: string | null;
  urlBaseAssinatura?: string | null;
}

export interface ContratoGerado {
  id: string;
  empresaId: string;
  modeloId: string | null;
  clienteId: string | null;
  empresaContraparteId: string | null; // exatamente um de clienteId/empresaContraparteId é preenchido
  titulo: string;
  status: StatusContrato;
  valoresTags: Record<string, string>;
  conteudoRenderizado: string;
  valorTotal: number | null;
  contaReceberId: string | null;
  contaPagarId: string | null; // só preenchido quando empresaContraparteId está preenchido
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
  clienteId: string | null;
  empresaContraparteId: string | null;
  titulo: string;
  valoresTags: Record<string, string>;
  conteudoRenderizado: string;
  valorTotal: number | null;
  contaReceberId: string | null;
  contaPagarId: string | null;
  criadoPor: string;
}

export interface DadosAtualizarContrato {
  titulo?: string;
  valoresTags?: Record<string, string>;
  conteudoRenderizado?: string;
  // Só usados por RegistrarAditivoUseCase quando o aditivo troca valor/parcelamento --
  // AtualizarContratoUseCase (edição livre de rascunho) nunca mexe nesses campos.
  valorTotal?: number | null;
  contaReceberId?: string | null;
  contaPagarId?: string | null;
}

/** Parâmetros de emitir_cobranca_interna (migration 20260912000002) -- gera receber(credora)+pagar(devedora) numa transação só. */
export interface DadosCobrancaInterna {
  empresaCredoraId: string;
  nomeDevedor: string;
  contaPatrimonialCredoraId: string;
  contaResultadoCredoraId: string;
  empresaDevedoraId: string;
  nomeCredor: string;
  contaResultadoDevedoraId: string;
  contaPatrimonialDevedoraId: string;
  descricao: string;
  dataEmissao: string;
  criadoPor: string;
  parcelas: { numeroParcela: number; valorParcela: number; dataVencimento: string }[];
  contratoId: string | null;
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

  /** Financeiro cross-tenant: cria os dois lados (receber+pagar) numa transação só. Ver emitir_cobranca_interna. */
  emitirCobrancaInterna(dados: DadosCobrancaInterna): Promise<{ contaReceberId: string; contaPagarId: string }>;
  /** Cancela os dois lados de uma cobrança interna já emitida (busca o vínculo pelo contrato). */
  estornarCobrancaInternaDoContrato(contratoId: string, motivo: string, executadoPor: string): Promise<void>;
}

export const CONTRATOS_REPOSITORIO = Symbol('CONTRATOS_REPOSITORIO');
