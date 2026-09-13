import { Inject, Injectable } from '@nestjs/common';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { ladoDoRemetente } from '../../dominio/ticket';
import { MENSAGENS_REPOSITORIO, MensagensRepositorioPort } from '../portas/mensagens-repositorio.port';
import { FiltroTickets, TICKETS_REPOSITORIO, TicketsRepositorioPort } from '../portas/tickets-repositorio.port';

export interface ResumoSuporte {
  abertos: number;
  emProgresso: number;
  pausados: number;
  fechados: number;
  paraResponder: number;
}

/** Os 5 KPIs do AdminSuporte/Suporte do jotaCaixa, no mesmo escopo (filtro) da listagem. */
@Injectable()
export class ObterResumoSuporteUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORIO) private readonly ticketsRepositorio: TicketsRepositorioPort,
    @Inject(MENSAGENS_REPOSITORIO) private readonly mensagensRepositorio: MensagensRepositorioPort,
  ) {}

  async executar(filtro: FiltroTickets, usuarioAtual: UsuarioAutenticado): Promise<ResumoSuporte> {
    const tickets = await this.ticketsRepositorio.listar(filtro);

    const naoFechados = tickets.filter((t) => t.status !== 'fechado');
    const ultimas = await this.mensagensRepositorio.obterUltimasPorTickets(naoFechados.map((t) => t.id));

    const paraResponder = naoFechados.filter((ticket) => {
      const ultima = ultimas.get(ticket.id);
      if (!ultima) return false;
      const ladoAtual = ladoDoRemetente(usuarioAtual.papel, ticket.destinatarioTipo);
      return ultima.remetenteLado !== ladoAtual;
    }).length;

    return {
      abertos: tickets.filter((t) => t.status === 'aberto').length,
      emProgresso: tickets.filter((t) => t.status === 'em_progresso').length,
      pausados: tickets.filter((t) => t.status === 'pausado').length,
      fechados: tickets.filter((t) => t.status === 'fechado').length,
      paraResponder,
    };
  }
}
