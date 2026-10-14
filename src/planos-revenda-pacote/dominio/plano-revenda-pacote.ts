/**
 * Espelha a trigger valida_margem_plano_revenda do banco -- revalidada aqui também
 * (Zero Trust, docs/SEGURANCA.md), não só confiar que o trigger vai pegar o erro depois.
 */
export function validarMargem(valorVenda: number, precoPacote: number): void {
  if (valorVenda < precoPacote) {
    throw new Error(
      `Valor de venda não pode ser menor que o repasse da plataforma (${precoPacote.toFixed(2)})`,
    );
  }
}
