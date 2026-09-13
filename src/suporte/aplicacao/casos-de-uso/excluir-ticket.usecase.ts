import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { podeExcluir } from '../../dominio/ticket';
import { TICKETS_REPOSITORIO, TicketsRepositorioPort } from '../portas/tickets-repositorio.port';

@Injectable()
export class ExcluirTicketUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORIO) private readonly ticketsRepositorio: TicketsRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, usuarioAtual: UsuarioAutenticado): Promise<void> {
    const ticket = await this.ticketsRepositorio.obterPorId(id);
    if (!ticket) throw new NotFoundException('Ticket não encontrado');

    if (!podeExcluir(usuarioAtual.papel, ticket.destinatarioTipo, ticket.status)) {
      throw new ForbiddenException('Sem autoridade pra excluir este ticket agora');
    }

    await this.ticketsRepositorio.excluir(id);

    await this.auditoria.registrar({
      usuarioId: usuarioAtual.id,
      contadorId: ticket.contadorId,
      empresaId: ticket.empresaId,
      acao: 'EXCLUIR_TICKET_SUPORTE',
      recurso: `suporte_tickets:${id}`,
      dadosAntigos: { titulo: ticket.titulo, status: ticket.status },
    });
  }
}
