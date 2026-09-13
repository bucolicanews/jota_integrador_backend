import { IsIn } from 'class-validator';
import { STATUS_TICKET, StatusTicket } from '../../dominio/ticket';

export class AtualizarStatusTicketDto {
  @IsIn(STATUS_TICKET)
  status!: StatusTicket;
}
