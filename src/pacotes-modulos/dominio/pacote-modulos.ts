// Catálogo estático de módulos "extras" que entram no controle de licenciamento --
// núcleo contábil (lançamentos, plano de contas, contas a pagar/receber, clientes,
// fornecedores, históricos) nunca entra aqui, é sempre liberado (ver empresa_tem_modulo,
// que já trata empresa interna de contador/plataforma como sempre liberada também).
export const MODULOS_LICENCIAVEIS = [
  'contratos',
  'documentos_societarios',
  'conciliacao_bancaria',
  'protocolos',
  'bancos',
  'relatorios',
  // Separado de "contabilidade" (que nunca entra aqui, é núcleo sempre liberado) --
  // cobre tudo que fala com o SERPRO em nome da empresa: DAS, Caixa Postal, CCMEI,
  // Procuração/Certificado (acesso_serpro).
  'fiscal',
] as const;

export type ModuloLicenciavel = (typeof MODULOS_LICENCIAVEIS)[number];

export function modulosValidos(modulos: string[]): boolean {
  return modulos.length > 0 && modulos.every((m) => (MODULOS_LICENCIAVEIS as readonly string[]).includes(m));
}

/**
 * Espelha a constraint pacotes_modulos_gratuito_preco_check do banco -- revalidada aqui
 * também (Zero Trust, docs/SEGURANCA.md), não só confiar que o CHECK vai pegar o erro.
 */
export function validarPrecoGratuito(preco: number, gratuito: boolean): void {
  if (!gratuito && preco <= 0) {
    throw new Error('Pacote pago precisa de preço maior que zero -- marque "grátis" ou informe um preço válido');
  }
}

/** Pacote expirado não pode ser comprado/ativado de novo (licença já ativa não é revogada). */
export function pacoteExpirado(dataValidade: string | null): boolean {
  if (!dataValidade) return false;
  return dataValidade < new Date().toISOString().slice(0, 10);
}
