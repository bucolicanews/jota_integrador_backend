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
}

export const DAS_REPOSITORIO = Symbol('DAS_REPOSITORIO');
