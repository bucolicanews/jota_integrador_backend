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
] as const;

export type ModuloLicenciavel = (typeof MODULOS_LICENCIAVEIS)[number];

export function modulosValidos(modulos: string[]): boolean {
  return modulos.length > 0 && modulos.every((m) => (MODULOS_LICENCIAVEIS as readonly string[]).includes(m));
}
