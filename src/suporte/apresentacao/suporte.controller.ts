import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma, Papel } from '../../auth/dominio/papel';
import { AtualizarPrioridadeTicketUseCase } from '../aplicacao/casos-de-uso/atualizar-prioridade-ticket.usecase';
import { AtualizarStatusTicketUseCase } from '../aplicacao/casos-de-uso/atualizar-status-ticket.usecase';
import { CriarTicketUseCase } from '../aplicacao/casos-de-uso/criar-ticket.usecase';
import { EnviarMensagemUseCase } from '../aplicacao/casos-de-uso/enviar-mensagem.usecase';
import { ExcluirTicketUseCase } from '../aplicacao/casos-de-uso/excluir-ticket.usecase';
import { ListarMensagensUseCase } from '../aplicacao/casos-de-uso/listar-mensagens.usecase';
import { ListarTicketsUseCase } from '../aplicacao/casos-de-uso/listar-tickets.usecase';
import { ObterResumoSuporteUseCase, ResumoSuporte } from '../aplicacao/casos-de-uso/obter-resumo-suporte.usecase';
import { ObterTicketUseCase } from '../aplicacao/casos-de-uso/obter-ticket.usecase';
import { ObterUrlAnexoMensagemUseCase, UrlAnexoMensagem } from '../aplicacao/casos-de-uso/obter-url-anexo-mensagem.usecase';
import { MensagemTicket } from '../aplicacao/portas/mensagens-repositorio.port';
import { FiltroTickets, Ticket } from '../aplicacao/portas/tickets-repositorio.port';
import { StatusTicket } from '../dominio/ticket';
import { AtualizarPrioridadeTicketDto } from './dto/atualizar-prioridade-ticket.dto';
import { AtualizarStatusTicketDto } from './dto/atualizar-status-ticket.dto';
import { CriarTicketDto } from './dto/criar-ticket.dto';
import { EnviarMensagemDto } from './dto/enviar-mensagem.dto';

const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024;
const PAPEIS_QUE_ABREM_TICKET = [Papel.CONTADOR_DONO, Papel.OPERADOR_CONTADOR, Papel.EMPRESARIO_DONO, Papel.OPERADOR_EMPRESA];

@Controller('suporte')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class SuporteController {
  constructor(
    private readonly criarTicket: CriarTicketUseCase,
    private readonly listarTickets: ListarTicketsUseCase,
    private readonly obterTicket: ObterTicketUseCase,
    private readonly atualizarStatusTicket: AtualizarStatusTicketUseCase,
    private readonly atualizarPrioridadeTicket: AtualizarPrioridadeTicketUseCase,
    private readonly excluirTicket: ExcluirTicketUseCase,
    private readonly listarMensagens: ListarMensagensUseCase,
    private readonly enviarMensagem: EnviarMensagemUseCase,
    private readonly obterUrlAnexoMensagem: ObterUrlAnexoMensagemUseCase,
    private readonly obterResumo: ObterResumoSuporteUseCase,
  ) {}

  @Get('tickets')
  @ExigirPermissao('suporte:visualizar')
  async listar(
    @Query('origem') origem: 'empresas' | 'proprios' | undefined,
    @Query('contadorId') contadorIdConsulta: string | undefined,
    @Query('status') status: StatusTicket | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Ticket[]> {
    return this.listarTickets.executar(this.resolverFiltro(usuarioAtual, origem, contadorIdConsulta, status));
  }

  @Get('resumo')
  @ExigirPermissao('suporte:visualizar')
  async resumo(
    @Query('origem') origem: 'empresas' | 'proprios' | undefined,
    @Query('contadorId') contadorIdConsulta: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResumoSuporte> {
    return this.obterResumo.executar(this.resolverFiltro(usuarioAtual, origem, contadorIdConsulta, undefined), usuarioAtual);
  }

  @Get('tickets/:id')
  @ExigirPermissao('suporte:visualizar')
  async obter(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<Ticket> {
    const ticket = await this.obterTicket.executar(id);
    this.exigirPosse(usuarioAtual, ticket);
    return ticket;
  }

  @Post('tickets')
  @Papeis(...PAPEIS_QUE_ABREM_TICKET)
  @ExigirPermissao('suporte:criar')
  @UseInterceptors(FileInterceptor('anexo', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async criar(
    @UploadedFile() anexo: Express.Multer.File | undefined,
    @Body() dto: CriarTicketDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ) {
    return this.criarTicket.executar({
      titulo: dto.titulo,
      prioridade: dto.prioridade,
      mensagemInicial: dto.mensagemInicial,
      ticketReferenciaId: dto.ticketReferenciaId ?? null,
      anexo: anexo ? { nomeOriginal: anexo.originalname, buffer: anexo.buffer, contentType: anexo.mimetype } : null,
      usuarioAtual,
    });
  }

  @Patch('tickets/:id/status')
  @ExigirPermissao('suporte:editar')
  async atualizarStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarStatusTicketDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const ticket = await this.obterTicket.executar(id);
    this.exigirPosse(usuarioAtual, ticket);
    await this.atualizarStatusTicket.executar(id, dto.status, usuarioAtual.id);
    return { ok: true };
  }

  @Patch('tickets/:id/prioridade')
  @ExigirPermissao('suporte:editar')
  async atualizarPrioridade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarPrioridadeTicketDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const ticket = await this.obterTicket.executar(id);
    this.exigirPosse(usuarioAtual, ticket);
    await this.atualizarPrioridadeTicket.executar(id, dto.prioridade, usuarioAtual);
    return { ok: true };
  }

  @Delete('tickets/:id')
  @ExigirPermissao('suporte:excluir')
  async excluir(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<{ ok: true }> {
    const ticket = await this.obterTicket.executar(id);
    this.exigirPosse(usuarioAtual, ticket);
    await this.excluirTicket.executar(id, usuarioAtual);
    return { ok: true };
  }

  @Get('tickets/:id/mensagens')
  @ExigirPermissao('suporte:visualizar')
  async listarMensagensDoTicket(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<MensagemTicket[]> {
    const ticket = await this.obterTicket.executar(id);
    this.exigirPosse(usuarioAtual, ticket);
    return this.listarMensagens.executar(id);
  }

  @Post('tickets/:id/mensagens')
  @ExigirPermissao('suporte:editar')
  @UseInterceptors(FileInterceptor('anexo', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async enviar(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() anexo: Express.Multer.File | undefined,
    @Body() dto: EnviarMensagemDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<MensagemTicket> {
    const ticket = await this.obterTicket.executar(id);
    this.exigirPosse(usuarioAtual, ticket);
    return this.enviarMensagem.executar({
      ticketId: id,
      conteudo: dto.conteudo,
      anexo: anexo ? { nomeOriginal: anexo.originalname, buffer: anexo.buffer, contentType: anexo.mimetype } : null,
      usuarioAtual,
    });
  }

  @Get('tickets/:id/mensagens/:mensagemId/anexo-url')
  @ExigirPermissao('suporte:visualizar')
  async urlAnexoMensagem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mensagemId', ParseUUIDPipe) mensagemId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<UrlAnexoMensagem> {
    const ticket = await this.obterTicket.executar(id);
    this.exigirPosse(usuarioAtual, ticket);
    return this.obterUrlAnexoMensagem.executar(id, mensagemId);
  }

  /** Mesma resolução de escopo do GET auth/usuarios (Fase 7): empresa só vê a própria; contador vê a carteira (opcionalmente só um dos dois grupos via `origem`); plataforma vê tudo, filtrável por contador. */
  private resolverFiltro(
    usuarioAtual: UsuarioAutenticado,
    origem: 'empresas' | 'proprios' | undefined,
    contadorIdConsulta: string | undefined,
    status: StatusTicket | undefined,
  ): FiltroTickets {
    const filtro: FiltroTickets = {};
    if (status) filtro.status = status;

    if (usuarioAtual.papel === Papel.EMPRESARIO_DONO || usuarioAtual.papel === Papel.OPERADOR_EMPRESA) {
      if (!usuarioAtual.empresaId) throw new ForbiddenException('Usuário sem empresa vinculada');
      filtro.empresaId = usuarioAtual.empresaId;
      return filtro;
    }

    if (usuarioAtual.papel === Papel.CONTADOR_DONO || usuarioAtual.papel === Papel.OPERADOR_CONTADOR) {
      if (!usuarioAtual.contadorId) throw new ForbiddenException('Usuário sem contador vinculado');
      filtro.contadorId = usuarioAtual.contadorId;
      if (origem === 'proprios') filtro.destinatarioTipo = 'plataforma';
      else if (origem === 'empresas') filtro.destinatarioTipo = 'contador';
      return filtro;
    }

    // Plataforma: só tickets destinados à plataforma, filtrável por contador.
    filtro.destinatarioTipo = 'plataforma';
    if (contadorIdConsulta) filtro.contadorId = contadorIdConsulta;
    return filtro;
  }

  private exigirPosse(usuarioAtual: UsuarioAutenticado, ticket: Ticket): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    const ehDoContador = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === ticket.contadorId;
    const ehDaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === ticket.empresaId;
    if (!ehDoContador && !ehDaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre este ticket');
    }
  }
}
