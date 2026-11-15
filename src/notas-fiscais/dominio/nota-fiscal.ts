export type ModeloNotaFiscal = '55' | '65';
export type DirecaoNotaFiscal = 'entrada' | 'saida';
export type StatusNotaFiscal = 'capturada' | 'aprovada' | 'rejeitada';

/** protNFe/infProt/cStat -- só 100 (autorizada) entra na fila normal de aprovação. */
export const C_STAT_AUTORIZADA = 100;

export interface ItemNotaFiscalExtraido {
  numeroItem: number;
  codigoProduto: string | null;
  descricao: string;
  ncm: string | null;
  cest: string | null;
  cfop: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  /** Bruto como veio -- CST normal (ICMS00..90), CSOSN (emitente Simples Nacional) ou CST60/61/70 (monofásico combustível). Nunca normalizado. */
  cstCsosn: string | null;
  valorIcms: number;
  /** ICMS-ST tradicional (vICMSST) OU monofásico retido anteriormente (vICMSMonoRet/vICMSSTRet) -- ambos representam imposto já recolhido substitutivamente, fora da apuração normal da nota. */
  valorIcmsSt: number;
  valorPis: number;
  /** Bruto como veio -- CST de saída PIS (01-09, 49, 99). 04=monofásica alíquota zero, 05=substituição tributária. Nunca normalizado. */
  cstPis: string | null;
  valorCofins: number;
  /** Mesmo domínio de códigos do cstPis, pra COFINS. */
  cstCofins: string | null;
  /** Reforma tributária -- quase sempre 0 em 2026 (fase de teste), capturado pra quando vier preenchido. */
  valorCbs: number;
  valorIbs: number;
  /** Grupo de imposto inteiro do item (ICMS/IPI/PIS/COFINS/IBSCBS), cru, como veio no XML. */
  impostoBruto: unknown;
}

export interface ParcelaNotaFiscalExtraida {
  numeroDuplicata: string;
  /** AAAA-MM-DD */
  dataVencimento: string;
  valor: number;
}

/** tPag (01 Dinheiro, 02 Cheque, 03 Cartão Crédito, 04 Cartão Débito, 05 Crédito Loja, 10-13 Vale, 14 Duplicata Mercantil, 15 Boleto, 16 Depósito Bancário, 17 PIX, 18 Transferência/Carteira Digital, 19 Fidelidade/Cashback, 90 Sem pagamento, 99 Outros) -- bruto como veio, nunca normalizado. */
export type FormaPagamentoNotaFiscal = string;
/** indPag -- '0' à vista, '1' a prazo (layout 4.00 em diante também tem '2' outros). */
export type IndicadorPagamentoNotaFiscal = '0' | '1' | '2';

export interface PagamentoNotaFiscalExtraido {
  indicadorPagamento: IndicadorPagamentoNotaFiscal | null;
  formaPagamento: FormaPagamentoNotaFiscal;
  valor: number;
}

export interface NotaFiscalExtraida {
  chaveAcesso: string;
  modelo: ModeloNotaFiscal;
  numero: string;
  serie: string;
  /** ISO com timezone, direto de ide/dhEmi. */
  dataEmissao: string;
  cStat: number;
  emitenteCnpj: string;
  emitenteNome: string;
  destinatarioDocumento: string | null;
  destinatarioNome: string | null;
  valorTotal: number;
  itens: ItemNotaFiscalExtraido[];
  parcelas: ParcelaNotaFiscalExtraida[];
  /** Grupo pag/detPag -- vazio em XML antigo sem esse grupo (nunca bloqueia ingestão por isso, mesmo princípio de parcelas vazio). */
  pagamentos: PagamentoNotaFiscalExtraido[];
  /** Parse completo do XML -- nunca perde dado não mapeado nos campos tipados acima. */
  xmlBruto: unknown;
}
