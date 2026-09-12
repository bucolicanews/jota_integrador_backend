export type StatusContrato = 'rascunho' | 'pendente_assinatura' | 'ativo' | 'cancelado' | 'concluido' | 'bloqueado';
export const STATUS_CONTRATO: StatusContrato[] = ['rascunho', 'pendente_assinatura', 'ativo', 'cancelado', 'concluido', 'bloqueado'];

/** Terminal: não aceita mais nenhuma transição. */
export function ehStatusTerminal(status: StatusContrato): boolean {
  return status === 'cancelado' || status === 'concluido';
}

export function podeEditarConteudo(status: StatusContrato): boolean {
  return status === 'rascunho' || status === 'pendente_assinatura';
}

export function podeExcluir(status: StatusContrato): boolean {
  return status === 'rascunho' || status === 'pendente_assinatura';
}

export function podeGerarLinkAssinatura(status: StatusContrato): boolean {
  return status === 'rascunho' || status === 'pendente_assinatura';
}

/** Só pendente_assinatura pode ser assinado -- rascunho precisa virar pendente_assinatura antes (gerar o link já faz essa transição). */
export function podeAssinar(status: StatusContrato): boolean {
  return status === 'pendente_assinatura';
}

export function podeBloquear(status: StatusContrato): boolean {
  return !ehStatusTerminal(status) && status !== 'bloqueado';
}

export function podeDesbloquear(status: StatusContrato): boolean {
  return status === 'bloqueado';
}

/**
 * Catálogo estático de tags do sistema -- resolvidas em código a partir de cliente/
 * empresa/dados financeiros, nunca cadastradas manualmente (diferente de `contrato_tags`,
 * que é o catálogo customizado por empresa). Nomes em maiúsculo, sem acento, mesmo
 * critério de qualquer identificador de sistema já usado no projeto.
 */
export const TAGS_SISTEMA = [
  'CLIENTE_NOME',
  'CLIENTE_RAZAO_SOCIAL',
  'CLIENTE_DOCUMENTO',
  'CLIENTE_EMAIL',
  'CLIENTE_TELEFONE',
  'CLIENTE_ENDERECO',
  'EMPRESA_RAZAO_SOCIAL',
  'EMPRESA_NOME_FANTASIA',
  'EMPRESA_CNPJ',
  'VALOR_TOTAL',
  'QUANTIDADE_PARCELAS',
  'DATA_HOJE',
] as const;

export type TagSistema = (typeof TAGS_SISTEMA)[number];

export interface DadosClienteParaTags {
  nome: string;
  razaoSocial: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
}

export interface DadosEmpresaParaTags {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
}

export interface DadosFinanceirosParaTags {
  valorTotal: number | null;
  quantidadeParcelas: number | null;
}

const fmtMoeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDataHoje = () => new Date().toLocaleDateString('pt-BR');

/** Resolve as TAGS_SISTEMA a partir de cliente/empresa/dados financeiros -- valor manual (valoresTagsManuais) nunca sobrescreve tag de sistema, evita que o usuário "falsifique" CLIENTE_NOME digitando outra coisa no mesmo nome de tag. */
export function resolverTagsAutomaticas(cliente: DadosClienteParaTags, empresa: DadosEmpresaParaTags, financeiro: DadosFinanceirosParaTags): Record<string, string> {
  return {
    CLIENTE_NOME: cliente.nome,
    CLIENTE_RAZAO_SOCIAL: cliente.razaoSocial ?? '',
    CLIENTE_DOCUMENTO: cliente.documento ?? '',
    CLIENTE_EMAIL: cliente.email ?? '',
    CLIENTE_TELEFONE: cliente.telefone ?? '',
    CLIENTE_ENDERECO: cliente.endereco ?? '',
    EMPRESA_RAZAO_SOCIAL: empresa.razaoSocial,
    EMPRESA_NOME_FANTASIA: empresa.nomeFantasia ?? empresa.razaoSocial,
    EMPRESA_CNPJ: empresa.cnpj,
    VALOR_TOTAL: financeiro.valorTotal != null ? fmtMoeda(financeiro.valorTotal) : '',
    QUANTIDADE_PARCELAS: financeiro.quantidadeParcelas != null ? String(financeiro.quantidadeParcelas) : '',
    DATA_HOJE: fmtDataHoje(),
  };
}
