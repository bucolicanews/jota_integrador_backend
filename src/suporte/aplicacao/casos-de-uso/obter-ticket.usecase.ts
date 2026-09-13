import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TICKETS_REPOSITORIO, Ticket, TicketsRepositorioPort } from '../portas/tickets-repositorio.port';

@Injectable()
export class ObterTicketUseCase {
  constructor(@Inject(TICKETS_REPOSITORIO) private readonly ticketsRepositorio: TicketsRepositorioPort) {}

  async executar(id: string): Promise<Ticket> {
    const ticket = await this.ticketsRepositorio.obterPorId(id);
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    return ticket;
  }
}
