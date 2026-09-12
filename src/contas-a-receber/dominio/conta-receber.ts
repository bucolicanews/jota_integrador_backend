export type StatusContaReceber = 'aberta' | 'parcial' | 'recebida' | 'cancelada';
export type ModoParcelamento = 'unico' | 'parcelar' | 'repetir';
export const MODOS_PARCELAMENTO: ModoParcelamento[] = ['unico', 'parcelar', 'repetir'];

/** status/valor recebido nunca são armazenados -- sempre derivados da soma de recebimentos não estornados (mesmo princípio de saldo_conta_contabil). */
export function calcularStatus(valorTotal: number, valorRecebido: number, cancelada: boolean): StatusContaReceber {
  if (cancelada) return 'cancelada';
  if (valorRecebido <= 0) return 'aberta';
  if (valorRecebido >= valorTotal) return 'recebida';
  return 'parcial';
}

interface ParcelaGerada {
  numeroParcela: number;
  valorParcela: number;
  dataVencimento: string;
}

/** Mesma lógica de geração de parcelas de contas-a-pagar/dominio/conta-pagar.ts (duplicada de propósito -- regra de domínio pura sem estado, duplicar é melhor que acoplar os dois módulos por causa de uma função). */
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

  return Array.from({ length: quantidade }, (_, i) => ({
    numeroParcela: i + 1,
    valorParcela: valor,
    dataVencimento: vencimentoDaParcela(i),
  }));
}
