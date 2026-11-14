import { DasItem, RegimeDas } from '../../dominio/das';

export interface DadosUpsertDasMei {
  empresaId: string;
  competencia: string;
  numeroDocumento: string | null;
  codigoBarras: string | null;
  /** NULL quando GERARDASPDF21 não devolveu valor estruturado nesta chamada. */
  valor: number | null;
  vencimento: string;
  pdfStorageRef: string | null;
  /** true quando o SERPRO respondeu `[Aviso-PGMEI-23018]` ("já foi efetuado pagamento... não será gerado DAS") -- sem isso, toda sincronização futura tentaria de novo e cobraria crédito de novo pela mesma competência já resolvida. */
  dasPago: boolean;
}

export interface ConfiguracaoLancamentosDas {
  empresaId: string;
  contaDebitoId: string;
  contaCreditoId: string;
}

export interface DadosSalvarConfiguracaoLancamentosDas {
  empresaId: string;
  contaDebitoId: string;
  contaCreditoId: string;
  atualizadoPor: string;
}

export interface DadosUpsertDasSimplesNacional {
  empresaId: string;
  competencia: string;
  numeroDas: string;
  /** NULL quando CONSEXTRATO16 não devolveu valor estruturado (confirmado: só traz {numeroDas, extrato:{nomeArquivo,pdf}}). */
  valorDas: number | null;
  vencimento: string;
  pdfStorageRef: string | null;
  /** CONSDECLARACAO13 já informa isso direto (indiceDas.dasPago) -- sem precisar de PAGTOWEB pra Simples Nacional. */
  dasPago: boolean;
  /** indiceDeclaracao.numeroDeclaracao -- null quando CONSDECLARACAO13 não devolveu (ver extrairDeclaracoes). Sem ele não dá pra buscar o recibo depois. */
  numeroDeclaracao: string | null;
  /** PDF do recibo de entrega (CONSDECREC15), já buscado no mesmo sync do Extrato -- null se a chamada falhou ou numeroDeclaracao não veio. */
  reciboStorageRef: string | null;
  /** PDF da Declaração (mesma chamada CONSDECREC15 do recibo) -- null nas mesmas condições. */
  declaracaoStorageRef: string | null;
}

/**
 * Abstrai as duas tabelas (`das_mei`, `declaracoes_pgdas`) atrás de uma interface só --
 * a camada de aplicação nunca sabe qual tabela física guarda qual regime, só pede
 * "upsert desta competência pra este regime" e recebe sempre o DTO unificado `DasItem`.
 */
export interface DasRepositorioPort {
  listarPorEmpresa(empresaId: string, regime: RegimeDas): Promise<DasItem[]>;
  buscarPorId(id: string, regime: RegimeDas): Promise<DasItem | null>;
  /** Insert-se-novo (idempotente por (empresa_id, competencia)) -- nunca sobrescreve um pdfStorageRef já existente. Retorna o item final (novo ou já existente). */
  upsertMei(dados: DadosUpsertDasMei): Promise<DasItem>;
  upsertSimplesNacional(dados: DadosUpsertDasSimplesNacional): Promise<DasItem>;
  /** DAS ainda 'pendente' de uma empresa, pra consulta em lote no PAGTOWEB/PAGAMENTOS71. */
  listarPendentesComNumeroDocumento(empresaId: string, regime: RegimeDas): Promise<DasItem[]>;
  marcarComoPago(id: string, regime: RegimeDas, pagoEm: string): Promise<void>;
  atualizarPdfStorageRef(id: string, regime: RegimeDas, pdfStorageRef: string): Promise<void>;
  /**
   * Resultado da 2ª via real (GERARDAS12, só PGDASD) -- sobrescreve valor/vencimento com
   * o dado estruturado mais confiável (vindo direto do JSON, não de regex em texto de
   * PDF) e grava o PDF do boleto separado do Extrato.
   */
  atualizarSegundaVia(
    id: string,
    dados: { valorDas: number | null; vencimento: string | null; pdfSegundaViaStorageRef: string },
  ): Promise<void>;
  /** Idempotência da provisão automática -- nunca gera 2x pro mesmo DAS. */
  marcarContaPagarProvisao(id: string, regime: RegimeDas, contaPagarId: string): Promise<void>;
  /** Marca a baixa (quitação) já resolvida -- sai da lista de pendências. */
  marcarLancamentoBaixa(id: string, regime: RegimeDas, lancamentoId: string): Promise<void>;
  /** status='pago' e ainda sem lancamento_baixa_id -- pendência aguardando o contador escolher caixa/banco. */
  listarPendentesDeBaixa(empresaId: string, regime: RegimeDas): Promise<DasItem[]>;
  buscarConfiguracaoLancamentos(empresaId: string): Promise<ConfiguracaoLancamentosDas | null>;
  salvarConfiguracaoLancamentos(dados: DadosSalvarConfiguracaoLancamentosDas): Promise<void>;
}

export const DAS_REPOSITORIO = Symbol('DAS_REPOSITORIO');
