import { XMLParser } from 'fast-xml-parser';
import {
  IndicadorPagamentoNotaFiscal,
  ItemNotaFiscalExtraido,
  ModeloNotaFiscal,
  NotaFiscalExtraida,
  PagamentoNotaFiscalExtraido,
  ParcelaNotaFiscalExtraida,
} from './nota-fiscal';

/**
 * parseTagValue/parseAttributeValue desligados de propósito -- a conversão automática de
 * tipo do fast-xml-parser destruiria códigos que parecem número mas têm zeros à esquerda
 * significativos (cProd="000001", NCM, CEST, nNF). Todo valor numérico real é convertido
 * manualmente abaixo, só nos campos que de fato precisam ser number.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** fast-xml-parser só produz array quando o elemento aparece 2+ vezes -- com 1 item/duplicata vira objeto solto. Normaliza os dois casos, e ausência vira []. */
function paraArray<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function paraNumero(valor: unknown): number {
  if (valor === undefined || valor === null || valor === '') return 0;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

/** ICMS tem exatamente 1 grupo filho cujo nome varia (ICMS00..90 regime normal, ICMSSN101..900 Simples Nacional via CSOSN, ICMS60/61/70 monofásico de combustível) -- sempre o primeiro (e único) filho do objeto ICMS. */
function primeiroGrupoFilho(grupo: any): any {
  if (!grupo || typeof grupo !== 'object') return null;
  const chave = Object.keys(grupo)[0];
  return chave ? grupo[chave] : null;
}

function extrairIcms(imposto: any): { cstCsosn: string | null; valorIcms: number; valorIcmsSt: number } {
  const dados = primeiroGrupoFilho(imposto?.ICMS);
  if (!dados) return { cstCsosn: null, valorIcms: 0, valorIcmsSt: 0 };
  return {
    cstCsosn: dados.CST ?? dados.CSOSN ?? null,
    valorIcms: paraNumero(dados.vICMS),
    // vICMSMonoRet/vICMSSTRet (monofásico de combustível) tem o mesmo papel de ICMS-ST
    // tradicional: imposto já recolhido substitutivamente, fora da apuração normal.
    valorIcmsSt: paraNumero(dados.vICMSST ?? dados.vICMSMonoRet ?? dados.vICMSSTRet),
  };
}

/** PIS/COFINS são polimórficos igual ICMS (PISAliq/PISOutr/PISNT/PISST...) -- cada subgrupo tem o próprio CST, usado pra identificar substituição tributária (05) e monofásica (04). */
function extrairPisCofins(imposto: any): { valorPis: number; cstPis: string | null; valorCofins: number; cstCofins: string | null } {
  const dadosPis = primeiroGrupoFilho(imposto?.PIS);
  const dadosCofins = primeiroGrupoFilho(imposto?.COFINS);
  return {
    valorPis: dadosPis ? paraNumero(dadosPis.vPIS) : 0,
    cstPis: dadosPis?.CST ?? null,
    valorCofins: dadosCofins ? paraNumero(dadosCofins.vCOFINS) : 0,
    cstCofins: dadosCofins?.CST ?? null,
  };
}

/** IBSCBS (reforma tributária) não é polimórfico como ICMS/PIS/COFINS -- é um grupo de nome fixo, com vIBS/vCBS quase sempre ausentes ou zerados nos XML reais de 2026 (fase de teste). */
function extrairIbsCbs(imposto: any): { valorCbs: number; valorIbs: number } {
  const ibscbs = imposto?.IBSCBS;
  if (!ibscbs) return { valorCbs: 0, valorIbs: 0 };
  return {
    valorCbs: paraNumero(ibscbs.gCBS?.vCBS ?? ibscbs.vCBS),
    valorIbs: paraNumero(ibscbs.gIBSUF?.vIBSUF ?? ibscbs.gIBS?.vIBS ?? ibscbs.vIBS),
  };
}

function extrairItem(det: any): ItemNotaFiscalExtraido {
  const prod = det.prod ?? {};
  const imposto = det.imposto ?? {};
  const icms = extrairIcms(imposto);
  const pisCofins = extrairPisCofins(imposto);
  const ibscbs = extrairIbsCbs(imposto);

  return {
    numeroItem: Number(det['@_nItem']),
    codigoProduto: prod.cProd ?? null,
    descricao: prod.xProd ?? '',
    ncm: prod.NCM ?? null,
    cest: prod.CEST ?? null,
    cfop: prod.CFOP,
    quantidade: paraNumero(prod.qCom),
    valorUnitario: paraNumero(prod.vUnCom),
    valorTotal: paraNumero(prod.vProd),
    cstCsosn: icms.cstCsosn,
    valorIcms: icms.valorIcms,
    valorIcmsSt: icms.valorIcmsSt,
    valorPis: pisCofins.valorPis,
    cstPis: pisCofins.cstPis,
    valorCofins: pisCofins.valorCofins,
    cstCofins: pisCofins.cstCofins,
    valorCbs: ibscbs.valorCbs,
    valorIbs: ibscbs.valorIbs,
    impostoBruto: imposto,
  };
}

function extrairParcelas(infNFe: any): ParcelaNotaFiscalExtraida[] {
  return paraArray(infNFe.cobr?.dup).map((dup: any) => ({
    numeroDuplicata: dup.nDup,
    dataVencimento: dup.dVenc,
    valor: paraNumero(dup.vDup),
  }));
}

/** indPag migrou de pag/@indPag (layout antigo) pra pag/detPag/indPag (layout 4.00+) -- cada detPag carrega o próprio indicador, nunca um único pra nota inteira. */
function extrairPagamentos(infNFe: any): PagamentoNotaFiscalExtraido[] {
  return paraArray(infNFe.pag?.detPag).map((detPag: any) => ({
    indicadorPagamento: (detPag.indPag ?? null) as IndicadorPagamentoNotaFiscal | null,
    formaPagamento: detPag.tPag ?? '99',
    valor: paraNumero(detPag.vPag),
  }));
}

/**
 * Parse de um XML de NFe (modelo 55) ou NFCe (modelo 65) -- aceita tanto o formato
 * processado completo (`nfeProc` com `NFe`+`protNFe`, o distribuído pela SEFAZ/Distribuição
 * DFe, caso normal) quanto um `NFe` solto sem protocolo (defensivo -- nesse caso cStat vira
 * 0, tratado como "não autorizada" pelo caso de uso de ingestão, igual qualquer cStat != 100).
 */
export function parseXmlNfe(xmlBruto: string): NotaFiscalExtraida {
  const raiz = parser.parse(xmlBruto);
  const nfeProc = raiz.nfeProc;
  const nfe = nfeProc?.NFe ?? raiz.NFe;
  if (!nfe?.infNFe) {
    throw new Error('XML não é uma NFe/NFCe reconhecível (elemento infNFe não encontrado)');
  }

  const infNFe = nfe.infNFe;
  const protNFe = nfeProc?.protNFe ?? null;
  const ide = infNFe.ide;
  const emit = infNFe.emit;
  const dest = infNFe.dest ?? null;

  const chaveDoAtributoId = String(infNFe['@_Id'] ?? '').replace(/^NFe/, '');
  const chaveAcesso = protNFe?.infProt?.chNFe || chaveDoAtributoId;

  return {
    chaveAcesso,
    modelo: ide.mod as ModeloNotaFiscal,
    numero: ide.nNF,
    serie: ide.serie,
    dataEmissao: ide.dhEmi,
    cStat: protNFe ? Number(protNFe.infProt.cStat) : 0,
    emitenteCnpj: emit.CNPJ,
    emitenteNome: emit.xNome,
    destinatarioDocumento: dest?.CNPJ ?? dest?.CPF ?? null,
    destinatarioNome: dest?.xNome ?? null,
    valorTotal: paraNumero(infNFe.total?.ICMSTot?.vNF),
    itens: paraArray(infNFe.det).map(extrairItem),
    parcelas: extrairParcelas(infNFe),
    pagamentos: extrairPagamentos(infNFe),
    xmlBruto: raiz,
  };
}
