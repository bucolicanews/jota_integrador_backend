import { MapeamentoColunasExtrato, TipoTransacaoExtrato } from './conciliacao';

export interface LinhaExtratoBruta {
  [coluna: string]: unknown;
}

export interface TransacaoExtraida {
  dataOriginal: string;
  dataIso: string | null;
  descricao: string;
  valor: number;
  tipo: TipoTransacaoExtrato;
  identificacao?: string;
}

/** dd/mm/yyyy, dd-mm-yyyy ou yyyy-mm-dd -- formatos mais comuns de extrato bancário BR. Fallback pro parser nativo do Date pra formatos menos comuns. */
function formatarDataParaIso(valorBruto: unknown): string | null {
  if (valorBruto === null || valorBruto === undefined || valorBruto === '') return null;
  const texto = String(valorBruto).trim();

  const matchBr = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (matchBr) {
    const [, dia, mes, ano] = matchBr;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);

  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data.toISOString().slice(0, 10);
}

/** Aceita "1.234,56", "1234.56" ou "1234,56" -- vírgula como separador decimal se presente, ponto vira separador de milhar nesse caso. */
function parseValorMonetario(valorBruto: unknown): number {
  if (valorBruto === null || valorBruto === undefined || valorBruto === '') return 0;
  let texto = String(valorBruto).trim().replace(/\s+/g, '');
  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  }
  const numero = Number.parseFloat(texto);
  return Number.isNaN(numero) ? 0 : numero;
}

/**
 * Extrai transações de linhas já parseadas do CSV, conforme o mapeamento configurado.
 * Modo "crédito/débito separados" tem prioridade sobre "valor único com sinal" se ambos
 * vierem preenchidos por engano (mesma regra do form de configuração no jotaCaixa: usar
 * um OU outro, nunca os dois -- aqui só decide qual prevalece em vez de rejeitar).
 * Linhas sem data válida ou sem descrição são descartadas (mesmo critério do jotaCaixa).
 */
export function extrairTransacoes(
  linhas: LinhaExtratoBruta[],
  mapeamento: MapeamentoColunasExtrato,
  colunaTipoTransacao: string | null,
  valorCredito: string | null,
): TransacaoExtraida[] {
  return linhas
    .map((linha): TransacaoExtraida => {
      const descricao = String(linha[mapeamento.descricao] ?? '').trim();
      const dataOriginal = String(linha[mapeamento.data] ?? '');
      const dataIso = formatarDataParaIso(linha[mapeamento.data]);
      const identificacao = mapeamento.identificacao
        ? String(linha[mapeamento.identificacao] ?? '').trim() || undefined
        : undefined;

      let valor: number;
      let tipo: TipoTransacaoExtrato;

      if (mapeamento.credito || mapeamento.debito) {
        const valorCreditoLinha = mapeamento.credito ? parseValorMonetario(linha[mapeamento.credito]) : 0;
        const valorDebitoLinha = mapeamento.debito ? parseValorMonetario(linha[mapeamento.debito]) : 0;
        if (Math.abs(valorCreditoLinha) > 0) {
          valor = Math.abs(valorCreditoLinha);
          tipo = 'Entrada';
        } else {
          valor = Math.abs(valorDebitoLinha);
          tipo = 'Saida';
        }
      } else {
        const bruto = parseValorMonetario(linha[mapeamento.valor ?? '']);
        valor = Math.abs(bruto);
        if (colunaTipoTransacao) {
          const marcador = String(linha[colunaTipoTransacao] ?? '');
          tipo = marcador === valorCredito ? 'Entrada' : 'Saida';
        } else {
          tipo = bruto >= 0 ? 'Entrada' : 'Saida';
        }
      }

      return { dataOriginal, dataIso, descricao, valor, tipo, identificacao };
    })
    .filter((transacao) => transacao.descricao && transacao.dataIso && transacao.valor > 0);
}
