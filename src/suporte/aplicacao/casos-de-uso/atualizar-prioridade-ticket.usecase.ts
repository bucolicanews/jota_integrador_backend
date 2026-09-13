import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { podeMudarPrioridade, PrioridadeTicket } from '../../dominio/ticket';
import { TICKETS_REPOSITORIO, TicketsRepositorioPort } from '../portas/tickets-repositorio.port';

/** Só o lado que recebe o ticket triagem a prioridade -- mesma regra do jotaCaixa (prioridade é admin-only lá). */
@Injectable()
export class AtualizarPrioridadeTicketUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORIO) private readonly ticketsRepositorio: TicketsRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, novaPrioridade: PrioridadeTicket, usuarioAtual: UsuarioAutenticado): Promise<void> {
    const ticket = await this.ticketsRepositorio.obterPorId(id);
    if (!ticket) throw new NotFoundException('Ticket não encontrado');

    if (!podeMudarPrioridade(usuarioAtual.papel, ticket.destinatarioTipo)) {
      throw new ForbiddenException('Só quem recebe o ticket pode mudar a prioridade');
    }

    await this.ticketsRepositorio.atualizarPrioridade(id, novaPrioridade);

    await this.auditoria.registrar({
      usuarioId: usuarioAtual.id,
      contadorId: ticket.contadorId,
      empresaId: ticket.empresaId,
      acao: 'ATUALIZAR_PRIORIDADE_TICKET_SUPORTE',
      recurso: `suporte_tickets:${id}`,
      dadosAntigos: { prioridade: ticket.prioridade },
      dadosNovos: { prioridade: novaPrioridade },
    });
  }
}
