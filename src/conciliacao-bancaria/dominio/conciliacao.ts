import { createHash } from 'crypto';

export type TipoTransacaoExtrato = 'Entrada' | 'Saida';
export const TIPOS_TRANSACAO_EXTRATO: TipoTransacaoExtrato[] = ['Entrada', 'Saida'];

/**
 * pendente = extraída do CSV, aguardando conta contábil + confirmação.
 * conciliada = lançamento criado (lancamento_id preenchido).
 * duplicada = já existia (mesma chave) numa importação anterior confirmada -- nunca conciliável de novo.
 * ignorada = usuário decidiu descartar sem lançar (ex: transação que não é do negócio).
 */
export type StatusTransacaoConciliacao = 'pendente' | 'conciliada' | 'duplicada' | 'ignorada';
export const STATUS_TRANSACAO_CONCILIACAO: StatusTransacaoConciliacao[] = ['pendente', 'conciliada', 'duplicada', 'ignorada'];

export interface MapeamentoColunasExtrato {
  data: string;
  descricao: string;
  // Modo 1: coluna de valor unico (com sinal, ou com coluna de tipo a parte).
  valor?: string | null;
  // Modo 2: colunas de credito e debito separadas -- usa uma ou outra, nunca as duas.
  credito?: string | null;
  debito?: string | null;
  identificacao?: string | null;
}

/** Remove acento e normaliza caixa -- mesma tecnica do jotaCaixa (normalizeString), pra comparacao de descricao tolerante a variacao de formatacao do banco. */
export function normalizarDescricao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Hash do conteudo do arquivo -- bloqueia reimportar o mesmo extrato duas vezes. */
export function calcularHashConteudo(conteudo: string): string {
  return createHash('sha256').update(conteudo).digest('hex');
}

/** Chave de dedupe de uma transacao: mesma data+descricao normalizada+valor+tipo ja existe? */
export function montarChaveTransacao(dataIso: string, descricaoNormalizada: string, valor: number, tipo: TipoTransacaoExtrato): string {
  return `${dataIso}|${descricaoNormalizada}|${valor.toFixed(2)}|${tipo}`;
}
