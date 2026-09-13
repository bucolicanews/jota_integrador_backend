import { IsIn, IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PRIORIDADE_TICKET, PrioridadeTicket } from '../../dominio/ticket';

export class CriarTicketDto {
  @MinLength(1)
  @MaxLength(300)
  titulo!: string;

  @IsIn(PRIORIDADE_TICKET)
  prioridade!: PrioridadeTicket;

  @MinLength(1)
  mensagemInicial!: string;

  @IsOptional()
  @IsUUID()
  ticketReferenciaId?: string;
}
