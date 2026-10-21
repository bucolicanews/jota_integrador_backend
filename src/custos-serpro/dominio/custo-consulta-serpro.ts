/** Regra de negócio pura -- mesmo que o CHECK do banco já garanta, revalidar aqui (Zero Trust, docs/SEGURANCA.md). */
export function validarCusto(custoReais: number): void {
  if (custoReais < 0) {
    throw new Error('custoReais não pode ser negativo');
  }
}

export function validarPrecoVenda(precoVendaReais: number): void {
  if (precoVendaReais < 0) {
    throw new Error('precoVendaReais não pode ser negativo');
  }
}
