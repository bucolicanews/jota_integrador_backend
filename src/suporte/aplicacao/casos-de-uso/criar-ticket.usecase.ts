import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../../auth/apresentacao/tipos/requisicao-autenticada';
import { ESCOPO_POR_PAPEL } from '../../../auth/dominio/papel';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { ladoDoRemetente, PrioridadeTicket } from '../../dominio/ticket';
import { MENSAGENS_REPOSITORIO, MensagemTicket, MensagensRepositorioPort } from '../portas/mensagens-repositorio.port';
import { TICKETS_REPOSITORIO, Ticket, TicketsRepositorioPort } from '../portas/tickets-repositorio.port';
import { StorageSuporteService } from '../../infraestrutura/storage-suporte.service';

export interface ArquivoAnexo {
  nomeOriginal: string;
  buffer: Buffer;
  contentType: string;
}

export interface DadosCriarTicket {
  titulo: string;
  prioridade: PrioridadeTicket;
  mensagemInicial: string;
  anexo: ArquivoAnexo | null;
  ticketReferenciaId: string | null;
  usuarioAtual: UsuarioAutenticado;
}

export interface ResultadoCriarTicket {
  ticket: Ticket;
  mensagem: MensagemTicket;
}

/**
 * Destino resolvido aqui a partir do papel de quem cria -- nunca aceito do client
 * (Zero Trust, mesma regra de `resolverVinculoPermitido` em auth.controller.ts):
 * escopo empresa -> ticket pro próprio contador; escopo contador -> ticket pra
 * plataforma. Papéis de plataforma não abrem ticket, só respondem.
 */
@Injectable()
export class CriarTicketUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORIO) private readonly ticketsRepositorio: TicketsRepositorioPort,
    @Inject(MENSAGENS_REPOSITORIO) private readonly mensagensRepositorio: MensagensRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly storage: StorageSuporteService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosCriarTicket): Promise<ResultadoCriarTicket> {
    const { usuarioAtual } = dados;
    const escopo = ESCOPO_POR_PAPEL[usuarioAtual.papel];

    let contadorId: string;
    let empresaId: string | null = null;
    const destinatarioTipo = escopo === 'empresa' ? 'contador' as const : 'plataforma' as const;

    if (escopo === 'empresa') {
      if (!usuarioAtual.empresaId) throw new ForbiddenException('Usuário sem empresa vinculada');
      const empresa = await this.empresasRepositorio.buscarPorId(usuarioAtual.empresaId);
      if (!empresa) throw new NotFoundException('Empresa não encontrada');
      empresaId = empresa.id;
      contadorId = empresa.contadorId;
    } else if (escopo === 'contador') {
      if (!usuarioAtual.contadorId) throw new ForbiddenException('Usuário sem contador vinculado');
      contadorId = usuarioAtual.contadorId;
    } else {
      throw new ForbiddenException('Papéis de plataforma não abrem ticket, só respondem');
    }

    if (dados.ticketReferenciaId) {
      const referencia = await this.ticketsRepositorio.obterPorId(dados.ticketReferenciaId);
      if (!referencia || referencia.destinatarioTipo !== 'contador' || referencia.contadorId !== contadorId) {
        throw new ForbiddenException('Ticket de referência inválido -- precisa ser um ticket de uma empresa da própria carteira');
      }
    }

    const ticket = await this.ticketsRepositorio.criar({
      titulo: dados.titulo,
      prioridade: dados.prioridade,
      destinatarioTipo,
      contadorId,
      empresaId,
      ticketReferenciaId: dados.ticketReferenciaId,
      criadoPor: usuarioAtual.id,
    });

    const anexoRef = dados.anexo ? await this.storage.armazenar(ticket.id, dados.anexo.nomeOriginal, dados.anexo.buffer, dados.anexo.contentType) : null;

    const mensagem = await this.mensagensRepositorio.criar({
      ticketId: ticket.id,
      remetenteId: usuarioAtual.id,
      remetenteLado: ladoDoRemetente(usuarioAtual.papel, destinatarioTipo),
      conteudo: dados.mensagemInicial,
      anexoNome: dados.anexo?.nomeOriginal ?? null,
      anexoStorageRef: anexoRef,
    });

    await this.auditoria.registrar({
      usuarioId: usuarioAtual.id,
      contadorId,
      empresaId,
      acao: 'CRIAR_TICKET_SUPORTE',
      recurso: `suporte_tickets:${ticket.id}`,
      dadosNovos: { titulo: ticket.titulo, destinatarioTipo, ticketReferenciaId: dados.ticketReferenciaId },
    });

    return { ticket, mensagem };
  }
}
