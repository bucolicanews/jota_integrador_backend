export type Periodicidade = 'mensal' | 'anual';

/**
 * Catálogo de módulos liberáveis -- antes vivia em pacotes-modulos/ (sistema de licença
 * eliminado em 2026-10-26, unificado em planos.modulos). Núcleo (lançamentos, plano de
 * contas, CP/CR, clientes, fornecedores, históricos) nunca entra aqui -- sempre liberado.
 */
export const MODULOS_LICENCIAVEIS = [
  'contratos',
  'documentos_societarios',
  'conciliacao_bancaria',
  'protocolos',
  'bancos',
  'relatorios',
  'fiscal',
] as const;

/** Regra de negócio pura -- mesmo que o CHECK do banco já garanta, revalidar aqui (Zero Trust, docs/SEGURANCA.md). */
export function validarDadosPlano(preco: number, gratuito: boolean, modulos: string[]): void {
  if (preco < 0) {
    throw new Error('preco não pode ser negativo');
  }
  if (!gratuito && preco <= 0) {
    throw new Error('Plano pago precisa de preço maior que zero -- marque "grátis" ou informe um preço válido');
  }
  if (modulos.length > 0 && !modulos.every((m) => (MODULOS_LICENCIAVEIS as readonly string[]).includes(m))) {
    throw new Error('Plano só pode anunciar módulos do catálogo de pacotes_modulos');
  }
}

/** Plano expirado não pode ser assinado de novo (assinatura já ativa não é cancelada automaticamente). */
export function planoExpirado(dataValidade: string | null): boolean {
  if (!dataValidade) return false;
  return dataValidade < new Date().toISOString().slice(0, 10);
}
