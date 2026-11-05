export type StatusLinkPagamento = 'pendente' | 'pago' | 'falhou';

/**
 * Comissão/posse já são garantidas pelo banco (triggers `definir_comissao_link_pagamento_parcela`/
 * `valida_vinculo_link_pagamento_parcela`, migration 20261104000002) -- aqui só a
 * validação de forma que faz sentido revalidar na Application antes de gastar uma
 * chamada ao banco (mesmo padrão de validarValorCobranca em honorários).
 */
export function validarValorLinkPagamento(valor: number): void {
  if (!(valor > 0)) {
    throw new Error('valor do link de pagamento precisa ser maior que zero');
  }
}
