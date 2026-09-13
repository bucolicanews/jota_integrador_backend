import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { StatusTicket } from '../../dominio/ticket';
import { TICKETS_REPOSITORIO, TicketsRepositorioPort } from '../portas/tickets-repositorio.port';

@Injectable()
export class AtualizarStatusTicketUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORIO) private readonly ticketsRepositorio: TicketsRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, novoStatus: StatusTicket, usuarioId: string): Promise<void> {
    const ticket = await this.ticketsRepositorio.obterPorId(id);
    if (!ticket) throw new NotFoundException('Ticket não encontrado');

    await this.ticketsRepositorio.atualizarStatus(id, novoStatus);

    await this.auditoria.registrar({
      usuarioId,
      contadorId: ticket.contadorId,
      empresaId: ticket.empresaId,
      acao: 'ATUALIZAR_STATUS_TICKET_SUPORTE',
      recurso: `suporte_tickets:${id}`,
      dadosAntigos: { status: ticket.status },
      dadosNovos: { status: novoStatus },
    });
  }
}
