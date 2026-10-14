import { MODULOS_LICENCIAVEIS } from '../../pacotes-modulos/dominio/pacote-modulos';

export type Periodicidade = 'mensal' | 'anual';

/** Regra de negócio pura -- mesmo que o CHECK do banco já garanta, revalidar aqui (Zero Trust, docs/SEGURANCA.md). */
export function validarDadosPlano(
  operacoesIncluidas: number,
  preco: number,
  gratuito: boolean,
  modulos: string[],
): void {
  if (!Number.isInteger(operacoesIncluidas) || operacoesIncluidas < 0) {
    throw new Error('operacoesIncluidas precisa ser um inteiro >= 0');
  }
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
