import { Papel } from '../../auth/dominio/papel';

export type StatusTicket = 'aberto' | 'em_progresso' | 'pausado' | 'fechado';
export type PrioridadeTicket = 'baixa' | 'media' | 'alta';
export type DestinatarioTicket = 'contador' | 'plataforma';
export type LadoMensagem = 'solicitante' | 'destinatario';

export const STATUS_TICKET: StatusTicket[] = ['aberto', 'em_progresso', 'pausado', 'fechado'];
export const PRIORIDADE_TICKET: PrioridadeTicket[] = ['baixa', 'media', 'alta'];

const PAPEIS_DESTINATARIO: Record<DestinatarioTicket, Papel[]> = {
  contador: [Papel.CONTADOR_DONO, Papel.OPERADOR_CONTADOR, Papel.SUPER_ADMIN],
  plataforma: [Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO, Papel.ADMIN_SUPORTE],
};

/**
 * Lado de quem manda uma mensagem, calculado a partir do papel de quem envia e do
 * destino do ticket -- nunca aceito do client. SUPER_ADMIN sempre cai do lado
 * destinatário, mesmo bypass universal de plataforma já usado no resto do projeto.
 */
export function ladoDoRemetente(papelRemetente: Papel, destinatarioTipo: DestinatarioTicket): LadoMensagem {
  return PAPEIS_DESTINATARIO[destinatarioTipo].includes(papelRemetente) ? 'destinatario' : 'solicitante';
}

/** A vez é sempre do lado oposto ao de quem mandou a última mensagem. */
export function proximoAResponder(ladoUltimaMensagem: LadoMensagem): LadoMensagem {
  return ladoUltimaMensagem === 'solicitante' ? 'destinatario' : 'solicitante';
}

/** Só o lado que recebe o ticket (contador numa mensagem de empresa; plataforma numa de contador) triagem a prioridade -- mesma regra do AdminSuporte do jotaCaixa. */
export function podeMudarPrioridade(papel: Papel, destinatarioTipo: DestinatarioTicket): boolean {
  return ladoDoRemetente(papel, destinatarioTipo) === 'destinatario';
}

/** Quem recebe o ticket exclui a qualquer momento; quem abriu só o próprio ticket já fechado. */
export function podeExcluir(papel: Papel, destinatarioTipo: DestinatarioTicket, status: StatusTicket): boolean {
  return ladoDoRemetente(papel, destinatarioTipo) === 'destinatario' || status === 'fechado';
}
