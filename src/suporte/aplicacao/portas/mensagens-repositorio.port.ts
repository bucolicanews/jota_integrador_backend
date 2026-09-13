import { LadoMensagem } from '../../dominio/ticket';

export interface MensagemTicket {
  id: string;
  ticketId: string;
  remetenteId: string;
  remetenteLado: LadoMensagem;
  conteudo: string;
  anexoNome: string | null;
  anexoStorageRef: string | null;
  criadoEm: string;
}

export interface DadosNovaMensagem {
  ticketId: string;
  remetenteId: string;
  remetenteLado: LadoMensagem;
  conteudo: string;
  anexoNome: string | null;
  anexoStorageRef: string | null;
}

export interface MensagensRepositorioPort {
  criar(dados: DadosNovaMensagem): Promise<MensagemTicket>;
  listarPorTicket(ticketId: string): Promise<MensagemTicket[]>;
  obterPorId(id: string): Promise<MensagemTicket | null>;
  /** Última mensagem de cada ticket em `ticketIds`, pra calcular "vez de responder" sem N+1 query. */
  obterUltimasPorTickets(ticketIds: string[]): Promise<Map<string, MensagemTicket>>;
}

export const MENSAGENS_REPOSITORIO = Symbol('MENSAGENS_REPOSITORIO');
