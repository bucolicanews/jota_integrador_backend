import { Inject, Injectable } from '@nestjs/common';
import { FiltroTickets, TICKETS_REPOSITORIO, Ticket, TicketsRepositorioPort } from '../portas/tickets-repositorio.port';

/** Filtro já resolvido pelo controller a partir do papel de quem pede (mesmo padrão de ListarUsuariosUseCase). */
@Injectable()
export class ListarTicketsUseCase {
  constructor(@Inject(TICKETS_REPOSITORIO) private readonly ticketsRepositorio: TicketsRepositorioPort) {}

  async executar(filtro: FiltroTickets): Promise<Ticket[]> {
    return this.ticketsRepositorio.listar(filtro);
  }
}
