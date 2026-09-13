import { DestinatarioTicket, PrioridadeTicket, StatusTicket } from '../../dominio/ticket';

export interface Ticket {
  id: string;
  titulo: string;
  status: StatusTicket;
  prioridade: PrioridadeTicket;
  destinatarioTipo: DestinatarioTicket;
  contadorId: string;
  empresaId: string | null;
  ticketReferenciaId: string | null;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosNovoTicket {
  titulo: string;
  prioridade: PrioridadeTicket;
  destinatarioTipo: DestinatarioTicket;
  contadorId: string;
  empresaId: string | null;
  ticketReferenciaId: string | null;
  criadoPor: string;
}

export interface FiltroTickets {
  contadorId?: string;
  empresaId?: string;
  destinatarioTipo?: DestinatarioTicket;
  status?: StatusTicket;
}

export interface TicketsRepositorioPort {
  criar(dados: DadosNovoTicket): Promise<Ticket>;
  listar(filtro: FiltroTickets): Promise<Ticket[]>;
  obterPorId(id: string): Promise<Ticket | null>;
  atualizarStatus(id: string, status: StatusTicket): Promise<void>;
  atualizarPrioridade(id: string, prioridade: PrioridadeTicket): Promise<void>;
  excluir(id: string): Promise<void>;
}

export const TICKETS_REPOSITORIO = Symbol('TICKETS_REPOSITORIO');
