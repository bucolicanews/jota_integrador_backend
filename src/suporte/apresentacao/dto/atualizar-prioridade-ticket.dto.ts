import { IsIn } from 'class-validator';
import { PRIORIDADE_TICKET, PrioridadeTicket } from '../../dominio/ticket';

export class AtualizarPrioridadeTicketDto {
  @IsIn(PRIORIDADE_TICKET)
  prioridade!: PrioridadeTicket;
}
