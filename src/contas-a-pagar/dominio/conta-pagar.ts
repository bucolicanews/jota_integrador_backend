export type StatusContaPagar = 'aberta' | 'parcial' | 'paga' | 'cancelada';
export type ModoParcelamento = 'unico' | 'parcelar' | 'repetir';
export const MODOS_PARCELAMENTO: ModoParcelamento[] = ['unico', 'parcelar', 'repetir'];

/** status/valor pago nunca são armazenados -- sempre derivados da soma de pagamentos não estornados (mesmo princípio de saldo_conta_contabil). */
export function calcularStatus(valorTotal: number, valorPago: number, cancelada: boolean): StatusContaPagar {
  if (cancelada) return 'cancelada';
  if (valorPago <= 0) return 'aberta';
  if (valorPago >= valorTotal) return 'paga';
  return 'parcial';
}

interface ParcelaGerada {
  numeroParcela: number;
  valorParcela: number;
  dataVencimento: string;
}

/**
 * Gera as parcelas conforme o modo escolhido (mesmas 3 opções do FormContasPagar.tsx
 * do jotaCaixa):
 * - unico: 1 parcela, valor = `valor`.
 * - repetir: `quantidadeParcelas` parcelas, cada uma no valor de `valor` (valor total =
 *   valor * quantidade).
 * - parcelar: `valor` é o TOTAL, dividido em `quantidadeParcelas` -- resto de
 *   arredondamento (centavos) vai inteiro pra última parcela, nunca se perde.
 */
export function gerarParcelas(
  modo: ModoParcelamento,
  valor: number,
  quantidadeParcelas: number,
  primeiroVencimento: string,
  intervaloDias: number,
): ParcelaGerada[] {
  const quantidade = modo === 'unico' ? 1 : quantidadeParcelas;
  if (quantidade < 1) throw new Error('Quantidade de parcelas precisa ser ao menos 1');

  const dataBase = new Date(`${primeiroVencimento}T00:00:00`);
  const vencimentoDaParcela = (indice: number): string => {
    const data = new Date(dataBase);
    data.setDate(data.getDate() + indice * intervaloDias);
    return data.toISOString().slice(0, 10);
  };

  if (modo === 'parcelar') {
    const valorBase = Math.floor((valor / quantidade) * 100) / 100;
    const parcelas: ParcelaGerada[] = [];
    let acumulado = 0;
    for (let i = 0; i < quantidade; i++) {
      const ehUltima = i === quantidade - 1;
      const valorParcela = ehUltima ? Math.round((valor - acumulado) * 100) / 100 : valorBase;
      acumulado += valorParcela;
      parcelas.push({ numeroParcela: i + 1, valorParcela, dataVencimento: vencimentoDaParcela(i) });
    }
    return parcelas;
  }

  // unico ou repetir: cada parcela tem o mesmo valor informado.
  return Array.from({ length: quantidade }, (_, i) => ({
    numeroParcela: i + 1,
    valorParcela: valor,
    dataVencimento: vencimentoDaParcela(i),
  }));
}
