import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { ladoDoRemetente } from '../../dominio/ticket';
import { MENSAGENS_REPOSITORIO, MensagemTicket, MensagensRepositorioPort } from '../portas/mensagens-repositorio.port';
import { TICKETS_REPOSITORIO, TicketsRepositorioPort } from '../portas/tickets-repositorio.port';
import { StorageSuporteService } from '../../infraestrutura/storage-suporte.service';
import { ArquivoAnexo } from './criar-ticket.usecase';

export interface DadosEnviarMensagem {
  ticketId: string;
  conteudo: string;
  anexo: ArquivoAnexo | null;
  usuarioAtual: UsuarioAutenticado;
}

@Injectable()
export class EnviarMensagemUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORIO) private readonly ticketsRepositorio: TicketsRepositorioPort,
    @Inject(MENSAGENS_REPOSITORIO) private readonly mensagensRepositorio: MensagensRepositorioPort,
    private readonly storage: StorageSuporteService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosEnviarMensagem): Promise<MensagemTicket> {
    const ticket = await this.ticketsRepositorio.obterPorId(dados.ticketId);
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    if (ticket.status === 'fechado') {
      throw new ForbiddenException('Ticket fechado -- reabra antes de enviar novas mensagens');
    }

    const anexoRef = dados.anexo ? await this.storage.armazenar(ticket.id, dados.anexo.nomeOriginal, dados.anexo.buffer, dados.anexo.contentType) : null;

    const mensagem = await this.mensagensRepositorio.criar({
      ticketId: ticket.id,
      remetenteId: dados.usuarioAtual.id,
      remetenteLado: ladoDoRemetente(dados.usuarioAtual.papel, ticket.destinatarioTipo),
      conteudo: dados.conteudo,
      anexoNome: dados.anexo?.nomeOriginal ?? null,
      anexoStorageRef: anexoRef,
    });

    // Toca atualizado_em do ticket (mesmo valor de status -- o trigger dispara em qualquer UPDATE).
    await this.ticketsRepositorio.atualizarStatus(ticket.id, ticket.status);

    await this.auditoria.registrar({
      usuarioId: dados.usuarioAtual.id,
      contadorId: ticket.contadorId,
      empresaId: ticket.empresaId,
      acao: 'ENVIAR_MENSAGEM_TICKET_SUPORTE',
      recurso: `suporte_tickets:${ticket.id}`,
      dadosNovos: { mensagemId: mensagem.id, temAnexo: !!anexoRef },
    });

    return mensagem;
  }
}
