/**
 * Categoriza se o ICMS ou o PIS/COFINS de um item de nota fiscal já foi recolhido por
 * terceiro (substituição tributária ou monofásico) -- nesse caso a Resolução CGSN 140/2018
 * exclui a parcela daquele tributo da alíquota efetiva aplicada à receita no mês (mecanismo
 * confirmado via pesquisa; número exato do artigo não confirmado com certeza total --
 * conferir com contador antes de citar em material oficial).
 *
 * CST de PIS/COFINS pra OPERAÇÃO DE SAÍDA (venda) vai de 01 a 09, mais 49/99 -- confirmado
 * contra 3 fontes convergentes (manual de prefeitura, tabela Exatos, Brasil NFe):
 *   01/02/03 = tributação normal
 *   04 = monofásica, revenda com alíquota zero  -> já recolhido
 *   05 = substituição tributária                -> já recolhido
 *   06/07/08/09 = alíquota zero/isenta/sem incidência/suspensão -- NÃO é necessariamente
 *     ST/monofásico (pode ser alíquota zero por outro motivo legal, ex. cesta básica).
 *     Tratado como "normal" por padrão conservador (não desconta parcela do DAS). Se o
 *     contador identificar que algum CFOP/CST da carteira de um cliente real é de fato
 *     monofásico disfarçado de alíquota-zero, isso é ajuste manual, não automático.
 *   49/99 = outras saídas/operações -- normal, default conservador.
 */
export function pisCofinsJaRecolhido(cstPis: string | null, cstCofins: string | null): boolean {
  const CODIGOS_JA_RECOLHIDO = new Set(['04', '05']);
  return CODIGOS_JA_RECOLHIDO.has(cstPis ?? '') || CODIGOS_JA_RECOLHIDO.has(cstCofins ?? '');
}

/**
 * ICMS já recolhido por ST/monofásico -- `valorIcmsSt > 0` já é o sinal mais direto (o
 * parser unifica vICMSST/vICMSMonoRet/vICMSSTRet nesse campo, ver parser-xml-nfe.ts).
 * CSOSN 500 ("ICMS cobrado anteriormente por ST ou por antecipação") é o caso em que o
 * emitente do Simples revende produto que já chegou com ICMS retido, mas pode vir sem
 * valor de ICMS-ST destacado nesse item específico -- por isso checado separadamente.
 */
export function icmsJaRecolhido(cstCsosn: string | null, valorIcmsSt: number): boolean {
  return valorIcmsSt > 0 || cstCsosn === '500';
}

export type CategoriaTributacaoItem = 'normal' | 'icms_ja_recolhido' | 'pis_cofins_ja_recolhido' | 'ambos_ja_recolhidos';

export function categorizarItem(dados: { cstCsosn: string | null; valorIcmsSt: number; cstPis: string | null; cstCofins: string | null }): CategoriaTributacaoItem {
  const icms = icmsJaRecolhido(dados.cstCsosn, dados.valorIcmsSt);
  const pisCofins = pisCofinsJaRecolhido(dados.cstPis, dados.cstCofins);
  if (icms && pisCofins) return 'ambos_ja_recolhidos';
  if (icms) return 'icms_ja_recolhido';
  if (pisCofins) return 'pis_cofins_ja_recolhido';
  return 'normal';
}
