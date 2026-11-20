import {
  DirecaoNotaFiscal,
  ItemNotaFiscalExtraido,
  ModeloNotaFiscal,
  NotaFiscalExtraida,
  PagamentoNotaFiscalExtraido,
  ParcelaNotaFiscalExtraida,
  StatusNotaFiscal,
} from '../../dominio/nota-fiscal';

export interface ItemNotaFiscalPersistido extends ItemNotaFiscalExtraido {
  id: string;
  notaFiscalId: string;
}

export interface ParcelaNotaFiscalPersistida extends ParcelaNotaFiscalExtraida {
  id: string;
}

export interface PagamentoNotaFiscalPersistido extends PagamentoNotaFiscalExtraido {
  id: string;
}

export interface NotaFiscalResumo {
  id: string;
  empresaId: string;
  chaveAcesso: string;
  modelo: ModeloNotaFiscal;
  direcao: DirecaoNotaFiscal;
  numero: string;
  serie: string;
  dataEmissao: string;
  cStat: number;
  emitenteCnpj: string;
  emitenteNome: string;
  destinatarioDocumento: string | null;
  destinatarioNome: string | null;
  municipioFatoGeradorIBGE: number | null;
  ufEmitente: string | null;
  valorTotal: number;
  fornecedorId: string | null;
  clienteId: string | null;
  contaPagarId: string | null;
  contaReceberId: string | null;
  status: StatusNotaFiscal;
  xmlStorageRef: string;
  motivoRejeicao: string | null;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  criadoEm: string;
}

export interface NotaFiscalDetalhe extends NotaFiscalResumo {
  itens: ItemNotaFiscalPersistido[];
  parcelas: ParcelaNotaFiscalPersistida[];
  pagamentos: PagamentoNotaFiscalPersistido[];
}

export interface DadosNovaNotaFiscal {
  empresaId: string;
  extraida: NotaFiscalExtraida;
  direcao: DirecaoNotaFiscal;
  xmlStorageRef: string;
  fornecedorId: string | null;
  clienteId: string | null;
}

export interface ConfiguracaoLancamentosNf {
  empresaId: string;
  contaPatrimonialEntradaId: string;
  contaResultadoEntradaId: string;
  contaPatrimonialSaidaId: string;
  contaResultadoSaidaId: string;
  /** Conta Caixa/Banco usada pra baixar automaticamente a conta a receber de NFCe paga em dinheiro à vista -- null desativa a baixa automática (fica "Aberta" igual hoje, baixa manual). */
  contaRecebimentoVistaId: string | null;
}

export interface DadosSalvarConfiguracaoLancamentosNf {
  empresaId: string;
  contaPatrimonialEntradaId: string;
  contaResultadoEntradaId: string;
  contaPatrimonialSaidaId: string;
  contaResultadoSaidaId: string;
  contaRecebimentoVistaId: string | null;
  atualizadoPor: string;
}

export interface NotasFiscaisRepositorioPort {
  /** Insere nota+itens+parcelas numa tacada -- idempotência real é checada antes (buscarPorChave) pelo caso de uso, não aqui. */
  criar(dados: DadosNovaNotaFiscal): Promise<string>;
  buscarPorChave(empresaId: string, chaveAcesso: string): Promise<NotaFiscalResumo | null>;
  /** Fila de revisão -- só status='capturada'. */
  listarPendentes(empresaId: string): Promise<NotaFiscalResumo[]>;
  /** Qualquer status, filtrado por data de emissão -- usado pelo dashboard de acompanhamento (KPIs, tendência, atividade recente). */
  listarPorPeriodo(empresaId: string, dataInicio: string, dataFim: string): Promise<NotaFiscalResumo[]>;
  /** Itens de um conjunto de notas -- usado pelo painel de Apuração Tributária pra agrupar por CFOP (chamador já filtrou as notas por empresa/período via listarPorPeriodo). */
  listarItensPorNotas(notaIds: string[]): Promise<ItemNotaFiscalPersistido[]>;
  obterDetalhe(id: string, empresaId: string): Promise<NotaFiscalDetalhe | null>;
  marcarAprovada(id: string, aprovadoPor: string, contaPagarId: string | null, contaReceberId: string | null): Promise<void>;
  marcarRejeitada(id: string, motivoRejeicao: string): Promise<void>;

  buscarConfiguracaoLancamentos(empresaId: string): Promise<ConfiguracaoLancamentosNf | null>;
  salvarConfiguracaoLancamentos(dados: DadosSalvarConfiguracaoLancamentosNf): Promise<void>;
}

export const NOTAS_FISCAIS_REPOSITORIO = Symbol('NOTAS_FISCAIS_REPOSITORIO');
