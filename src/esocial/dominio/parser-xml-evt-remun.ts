import { XMLParser } from 'fast-xml-parser';

/**
 * parseTagValue/parseAttributeValue desligados de propósito -- mesmo motivo do parser de
 * NF-e (src/notas-fiscais/dominio/parser-xml-nfe.ts): CPF/codCateg têm zeros à esquerda
 * significativos, conversão automática destruiria isso. Valores numéricos (vrRubr)
 * convertidos manualmente abaixo.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

function paraArray<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function paraNumero(valor: unknown): number {
  if (valor === undefined || valor === null || valor === '') return 0;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export type TipoItemRemuneracao = 'provento' | 'desconto';

export interface ItemRemuneracaoExtraido {
  /** Número da rubrica (ex: 1=Salário base, 3=Pró-labore, 71=INSS -- específico de cada
   * empresa, decodificado aqui só pelo prefixo "C{número}-" do codRubr do eSocial). */
  numeroRubrica: number;
  tipo: TipoItemRemuneracao;
  valor: number;
}

export type ClassificacaoTrabalhador = 'funcionario' | 'pro_labore';

// eSocial, Tabela 1 (Categorias de Trabalhadores) -- só os códigos confirmados contra fonte
// oficial (Anexo I dos leiautes), nunca por faixa numérica genérica: 101-106 = empregado
// CLT (geral/rural/aprendiz/doméstico/prazo determinado/temporário) -> salário; 721-723 =
// contribuinte individual diretor/sócio/empresário sem vínculo -> pró-labore. Fora dessa
// lista (ex: 711/712 autônomo transportador, 731/734 cooperado) não é nem salário nem
// pró-labore no sentido usado aqui -- fica null, exige escolha manual.
const CATEGORIAS_FUNCIONARIO = ['101', '102', '103', '104', '105', '106'];
const CATEGORIAS_PRO_LABORE = ['721', '722', '723'];

/** Retorna null quando o codCateg não está na lista confirmada -- nunca adivinha por faixa. */
export function inferirClassificacaoPorCodCateg(codCateg: string): ClassificacaoTrabalhador | null {
  if (CATEGORIAS_FUNCIONARIO.includes(codCateg)) return 'funcionario';
  if (CATEGORIAS_PRO_LABORE.includes(codCateg)) return 'pro_labore';
  return null;
}

export interface RemuneracaoExtraida {
  /** AAAA-MM */
  competencia: string;
  cpfTrab: string;
  /** Categoria do trabalhador (tabela eSocial -- 101=empregado geral CLT, 7xx=diretor/sócio
   * sem vínculo, entre outras) -- usado só pra SUGERIR funcionário vs pró-labore, nunca decide sozinho. */
  codCateg: string;
  itens: ItemRemuneracaoExtraido[];
}

/**
 * S-1200 (evtRemun) -- `codRubr` segue o padrão "C{número}-{TR|TD}-..." confirmado contra
 * os XMLs reais da empresa (C1=Salário base/TR, C3=Pró-labore/TR, C71=INSS/TD -- bate exato
 * com o log de submissão do S-1010 dela). TR=provento (rendimento), TD=desconto. Formato
 * fora desse padrão lança erro em vez de ignorar silenciosamente -- é dado financeiro, não
 * dá pra simplesmente descartar um item que não reconhece.
 */
export function parseXmlEvtRemun(xmlBruto: string): RemuneracaoExtraida {
  const documento = parser.parse(xmlBruto);
  const evento = documento?.eSocial?.evtRemun;
  if (!evento) {
    throw new Error('XML não é um evento evtRemun (S-1200) válido');
  }

  const perApur = evento.ideEvento?.perApur;
  const cpfTrab = evento.ideTrabalhador?.cpfTrab;
  const dmDev = evento.dmDev;
  if (!perApur || !cpfTrab || !dmDev) {
    throw new Error('XML evtRemun sem perApur/cpfTrab/dmDev');
  }

  const codCateg = String(dmDev.codCateg ?? '');
  const estabelecimentos = paraArray(dmDev.infoPerApur?.ideEstabLot);
  const itens: ItemRemuneracaoExtraido[] = [];

  for (const estabelecimento of estabelecimentos) {
    const remunPerApur = estabelecimento?.remunPerApur;
    const itensRemun = paraArray(remunPerApur?.itensRemun);
    for (const item of itensRemun) {
      const codRubr = String(item?.codRubr ?? '');
      const match = codRubr.match(/^C(\d+)-(TR|TD)-/);
      if (!match) {
        throw new Error(`codRubr em formato não reconhecido: "${codRubr}" -- confirmar contra o S-1010 da empresa`);
      }
      itens.push({
        numeroRubrica: Number(match[1]),
        tipo: match[2] === 'TR' ? 'provento' : 'desconto',
        valor: paraNumero(item?.vrRubr),
      });
    }
  }

  return { competencia: String(perApur), cpfTrab: String(cpfTrab), codCateg, itens };
}
