/**
 * Espelha a trigger valida_margem_plano_revenda_creditos do banco -- revalidada aqui
 * também (Zero Trust, docs/SEGURANCA.md), não só confiar que o trigger vai pegar o erro
 * depois. Mesmo princípio de plano-revenda-pacote/validarMargem.
 */
export function validarMargem(valorVenda: number, precoPlano: number): void {
  if (valorVenda < precoPlano) {
    throw new Error(
      `Valor de venda não pode ser menor que o repasse da plataforma (${precoPlano.toFixed(2)})`,
    );
  }
}
