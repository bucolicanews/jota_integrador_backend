import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { ExigirModulo } from '../../common/modulos/exigir-modulo.decorator';
import { ModulosGuard } from '../../common/modulos/modulos.guard';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AdicionarAnexoTarefaUseCase } from '../aplicacao/casos-de-uso/adicionar-anexo-tarefa.usecase';
import { AdicionarMembroEquipeUseCase } from '../aplicacao/casos-de-uso/adicionar-membro-equipe.usecase';
import { AtualizarColunaUseCase } from '../aplicacao/casos-de-uso/atualizar-coluna.usecase';
import { AtualizarComentarioTarefaUseCase } from '../aplicacao/casos-de-uso/atualizar-comentario-tarefa.usecase';
import { AtualizarQuadroUseCase } from '../aplicacao/casos-de-uso/atualizar-quadro.usecase';
import { AtualizarTarefaUseCase } from '../aplicacao/casos-de-uso/atualizar-tarefa.usecase';
import { CriarColunaUseCase } from '../aplicacao/casos-de-uso/criar-coluna.usecase';
import { CriarComentarioTarefaUseCase } from '../aplicacao/casos-de-uso/criar-comentario-tarefa.usecase';
import { CriarQuadroUseCase } from '../aplicacao/casos-de-uso/criar-quadro.usecase';
import { CriarTarefaUseCase } from '../aplicacao/casos-de-uso/criar-tarefa.usecase';
import { ExcluirColunaUseCase } from '../aplicacao/casos-de-uso/excluir-coluna.usecase';
import { ExcluirComentarioTarefaUseCase } from '../aplicacao/casos-de-uso/excluir-comentario-tarefa.usecase';
import { ExcluirQuadroUseCase } from '../aplicacao/casos-de-uso/excluir-quadro.usecase';
import { ExcluirTarefaUseCase } from '../aplicacao/casos-de-uso/excluir-tarefa.usecase';
import { ListarAnexosTarefaUseCase } from '../aplicacao/casos-de-uso/listar-anexos-tarefa.usecase';
import { ListarComentariosTarefaUseCase } from '../aplicacao/casos-de-uso/listar-comentarios-tarefa.usecase';
import { ListarEquipeTarefaUseCase } from '../aplicacao/casos-de-uso/listar-equipe-tarefa.usecase';
import { ListarFeedTarefasUseCase } from '../aplicacao/casos-de-uso/listar-feed-tarefas.usecase';
import { ListarHistoricoTarefaUseCase } from '../aplicacao/casos-de-uso/listar-historico-tarefa.usecase';
import { ListarQuadrosUseCase } from '../aplicacao/casos-de-uso/listar-quadros.usecase';
import { ListarTarefasUseCase } from '../aplicacao/casos-de-uso/listar-tarefas.usecase';
import { MoverTarefaUseCase } from '../aplicacao/casos-de-uso/mover-tarefa.usecase';
import { ObterUrlAnexoTarefaUseCase, UrlAnexoTarefa } from '../aplicacao/casos-de-uso/obter-url-anexo-tarefa.usecase';
import { RemoverMembroEquipeUseCase } from '../aplicacao/casos-de-uso/remover-membro-equipe.usecase';
import { ReordenarColunasUseCase } from '../aplicacao/casos-de-uso/reordenar-colunas.usecase';
import { Coluna, QuadroComColunas } from '../aplicacao/portas/quadros-tarefas-repositorio.port';
import {
  AnexoTarefa,
  ComentarioTarefa,
  EventoFeedTarefas,
  MembroEquipeTarefa,
  MovimentoHistorico,
  Tarefa,
} from '../aplicacao/portas/tarefas-repositorio.port';
import { AdicionarMembroEquipeDto } from './dto/adicionar-membro-equipe.dto';
import { AtualizarColunaDto } from './dto/atualizar-coluna.dto';
import { AtualizarComentarioDto } from './dto/atualizar-comentario.dto';
import { AtualizarQuadroDto } from './dto/atualizar-quadro.dto';
import { AtualizarTarefaDto } from './dto/atualizar-tarefa.dto';
import { CriarColunaDto } from './dto/criar-coluna.dto';
import { CriarComentarioDto } from './dto/criar-comentario.dto';
import { CriarQuadroDto } from './dto/criar-quadro.dto';
import { CriarTarefaDto } from './dto/criar-tarefa.dto';
import { MoverTarefaDto } from './dto/mover-tarefa.dto';
import { ReordenarColunasDto } from './dto/reordenar-colunas.dto';

const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024; // 10MB, mesmo limite de protocolos

/**
 * Diferente de protocolos (contador gerencia qualquer empresa da carteira): aqui cada
 * vínculo tem seu PRÓPRIO quadro isolado -- contador só vê/edita o quadro da própria
 * `interna_contador`, nunca o de uma empresa-cliente da carteira. `exigirPosseIsolada`
 * é a única checagem de autoridade (não existe a distinção leitura/escrita de
 * protocolos, porque não há "contador age por conta da empresa" neste módulo).
 *
 * N quadros por empresa (revisão 2026-11-12) -- toda rota de quadro/coluna recebe
 * `:quadroId` explícito e SEMPRE revalida que aquele quadro pertence à `empresaId` da
 * rota (`buscarQuadroOuFalhar`), nunca confia no path sozinho.
 */
@Controller('empresas/:empresaId/tarefas')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard, ModulosGuard)
@ExigirModulo('tarefas')
export class TarefasController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly listarQuadros: ListarQuadrosUseCase,
    private readonly criarQuadro: CriarQuadroUseCase,
    private readonly atualizarQuadro: AtualizarQuadroUseCase,
    private readonly excluirQuadro: ExcluirQuadroUseCase,
    private readonly criarColuna: CriarColunaUseCase,
    private readonly atualizarColuna: AtualizarColunaUseCase,
    private readonly reordenarColunas: ReordenarColunasUseCase,
    private readonly excluirColuna: ExcluirColunaUseCase,
    private readonly criarTarefa: CriarTarefaUseCase,
    private readonly listarTarefas: ListarTarefasUseCase,
    private readonly atualizarTarefa: AtualizarTarefaUseCase,
    private readonly moverTarefa: MoverTarefaUseCase,
    private readonly excluirTarefa: ExcluirTarefaUseCase,
    private readonly listarHistoricoTarefa: ListarHistoricoTarefaUseCase,
    private readonly adicionarAnexoTarefa: AdicionarAnexoTarefaUseCase,
    private readonly listarAnexosTarefa: ListarAnexosTarefaUseCase,
    private readonly obterUrlAnexoTarefa: ObterUrlAnexoTarefaUseCase,
    private readonly criarComentarioTarefa: CriarComentarioTarefaUseCase,
    private readonly listarComentariosTarefa: ListarComentariosTarefaUseCase,
    private readonly atualizarComentarioTarefa: AtualizarComentarioTarefaUseCase,
    private readonly excluirComentarioTarefa: ExcluirComentarioTarefaUseCase,
    private readonly listarFeedTarefas: ListarFeedTarefasUseCase,
    private readonly adicionarMembroEquipe: AdicionarMembroEquipeUseCase,
    private readonly removerMembroEquipe: RemoverMembroEquipeUseCase,
    private readonly listarEquipeTarefa: ListarEquipeTarefaUseCase,
  ) {}

  /** Timeline única da empresa -- comentário + movimentação de TODAS as tarefas, mais recente primeiro. */
  @Get('feed')
  @ExigirPermissao('tarefas:visualizar')
  async feed(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<EventoFeedTarefas[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.listarFeedTarefas.executar(empresaId);
  }

  @Get('quadros')
  @ExigirPermissao('tarefas:visualizar')
  async listarQuadrosRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<QuadroComColunas[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.listarQuadros.executar(empresaId);
  }

  @Post('quadros')
  @ExigirPermissao('tarefas:visualizar')
  async criarQuadroRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarQuadroDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<QuadroComColunas> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirDonoDoQuadro(usuarioAtual, empresa);
    return this.criarQuadro.executar(empresaId, dto.nome);
  }

  @Patch('quadros/:quadroId')
  @ExigirPermissao('tarefas:visualizar')
  async atualizarQuadroRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('quadroId', ParseUUIDPipe) quadroId: string,
    @Body() dto: AtualizarQuadroDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirDonoDoQuadro(usuarioAtual, empresa);
    await this.buscarQuadroOuFalhar(quadroId, empresaId);
    await this.atualizarQuadro.executar(quadroId, dto.nome);
    return { ok: true };
  }

  @Delete('quadros/:quadroId')
  @ExigirPermissao('tarefas:visualizar')
  async excluirQuadroRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('quadroId', ParseUUIDPipe) quadroId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirDonoDoQuadro(usuarioAtual, empresa);
    await this.buscarQuadroOuFalhar(quadroId, empresaId);
    await this.excluirQuadro.executar(quadroId);
    return { ok: true };
  }

  @Post('quadros/:quadroId/colunas')
  @ExigirPermissao('tarefas:visualizar')
  async criarColunaRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('quadroId', ParseUUIDPipe) quadroId: string,
    @Body() dto: CriarColunaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Coluna> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirDonoDoQuadro(usuarioAtual, empresa);
    await this.buscarQuadroOuFalhar(quadroId, empresaId);
    return this.criarColuna.executar(quadroId, dto.nome, dto.ehFinal ?? false);
  }

  @Patch('quadros/:quadroId/colunas/:colunaId')
  @ExigirPermissao('tarefas:visualizar')
  async atualizarColunaRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('quadroId', ParseUUIDPipe) quadroId: string,
    @Param('colunaId', ParseUUIDPipe) colunaId: string,
    @Body() dto: AtualizarColunaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirDonoDoQuadro(usuarioAtual, empresa);
    await this.buscarQuadroOuFalhar(quadroId, empresaId);
    await this.atualizarColuna.executar(colunaId, quadroId, dto);
    return { ok: true };
  }

  @Put('quadros/:quadroId/colunas/reordenar')
  @ExigirPermissao('tarefas:visualizar')
  async reordenarColunasRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('quadroId', ParseUUIDPipe) quadroId: string,
    @Body() dto: ReordenarColunasDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirDonoDoQuadro(usuarioAtual, empresa);
    await this.buscarQuadroOuFalhar(quadroId, empresaId);
    await this.reordenarColunas.executar(dto.colunaIds);
    return { ok: true };
  }

  @Delete('quadros/:quadroId/colunas/:colunaId')
  @ExigirPermissao('tarefas:visualizar')
  async excluirColunaRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('quadroId', ParseUUIDPipe) quadroId: string,
    @Param('colunaId', ParseUUIDPipe) colunaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirDonoDoQuadro(usuarioAtual, empresa);
    await this.buscarQuadroOuFalhar(quadroId, empresaId);
    await this.excluirColuna.executar(colunaId, quadroId);
    return { ok: true };
  }

  @Get()
  @ExigirPermissao('tarefas:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Tarefa[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.listarTarefas.executar(empresaId);
  }

  @Post()
  @ExigirPermissao('tarefas:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarTarefaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Tarefa> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);

    const quadroId = await this.resolverQuadroDaColuna(dto.colunaId, empresaId);

    return this.criarTarefa.executar({
      empresaId,
      quadroId,
      colunaId: dto.colunaId,
      titulo: dto.titulo,
      descricao: dto.descricao ?? null,
      criadoPor: usuarioAtual.id,
      atribuidoA: dto.atribuidoA ?? null,
      prioridade: dto.prioridade ?? 'media',
      prazo: dto.prazo ?? null,
      tempoEstimadoHoras: dto.tempoEstimadoHoras ?? null,
    });
  }

  @Patch(':id')
  @ExigirPermissao('tarefas:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarTarefaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    await this.atualizarTarefa.executar(id, empresaId, dto, usuarioAtual.id);
    return { ok: true };
  }

  @Patch(':id/mover')
  @ExigirPermissao('tarefas:editar')
  async mover(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoverTarefaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    await this.moverTarefa.executar(id, empresaId, dto.colunaId, dto.ordem, usuarioAtual.id, dto.responsavelId ?? null);
    return { ok: true };
  }

  @Delete(':id')
  @ExigirPermissao('tarefas:excluir')
  async excluir(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    await this.excluirTarefa.executar(id, empresaId);
    return { ok: true };
  }

  @Get(':id/historico')
  @ExigirPermissao('tarefas:visualizar')
  async historico(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<MovimentoHistorico[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.listarHistoricoTarefa.executar(id, empresaId);
  }

  @Get(':id/comentarios')
  @ExigirPermissao('tarefas:visualizar')
  async listarComentarios(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ComentarioTarefa[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.listarComentariosTarefa.executar(id, empresaId);
  }

  /** Sem checagem de posse de dono aqui -- a própria regra ("só o atribuído comenta") já é a autoridade real, aplicada dentro do usecase. */
  @Post(':id/comentarios')
  @ExigirPermissao('tarefas:editar')
  async criarComentario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CriarComentarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ComentarioTarefa> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.criarComentarioTarefa.executar(id, empresaId, usuarioAtual.id, dto.corpo);
  }

  @Patch(':id/comentarios/:comentarioId')
  @ExigirPermissao('tarefas:editar')
  async atualizarComentario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('comentarioId', ParseUUIDPipe) comentarioId: string,
    @Body() dto: AtualizarComentarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    await this.atualizarComentarioTarefa.executar(comentarioId, id, usuarioAtual.id, dto.corpo);
    return { ok: true };
  }

  @Delete(':id/comentarios/:comentarioId')
  @ExigirPermissao('tarefas:editar')
  async excluirComentario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('comentarioId', ParseUUIDPipe) comentarioId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    await this.excluirComentarioTarefa.executar(comentarioId, id, usuarioAtual.id);
    return { ok: true };
  }

  /** Equipe = candidatos a receber a tarefa (fila) -- distinto de atribuidoA (quem está com ela agora). Mesma autoridade de editar a tarefa. */
  @Get(':id/equipe')
  @ExigirPermissao('tarefas:visualizar')
  async listarEquipe(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<MembroEquipeTarefa[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.listarEquipeTarefa.executar(id, empresaId);
  }

  @Post(':id/equipe')
  @ExigirPermissao('tarefas:editar')
  async adicionarMembroEquipeRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdicionarMembroEquipeDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<MembroEquipeTarefa> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.adicionarMembroEquipe.executar(id, empresaId, dto.usuarioId, usuarioAtual.id);
  }

  @Delete(':id/equipe/:usuarioId')
  @ExigirPermissao('tarefas:editar')
  async removerMembroEquipeRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    await this.removerMembroEquipe.executar(id, empresaId, usuarioId);
    return { ok: true };
  }

  @Post(':id/anexos')
  @ExigirPermissao('tarefas:editar')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ANEXO } }))
  async adicionarAnexo(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<AnexoTarefa> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);

    if (!arquivo) {
      throw new NotFoundException('Arquivo (campo "arquivo") é obrigatório');
    }

    return this.adicionarAnexoTarefa.executar(
      id,
      empresaId,
      { nomeOriginal: arquivo.originalname, buffer: arquivo.buffer, contentType: arquivo.mimetype },
      usuarioAtual.id,
    );
  }

  @Get(':id/anexos')
  @ExigirPermissao('tarefas:visualizar')
  async listarAnexos(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<AnexoTarefa[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.listarAnexosTarefa.executar(id, empresaId);
  }

  @Get(':id/anexos/:anexoId/url')
  @ExigirPermissao('tarefas:visualizar')
  async urlAnexo(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('anexoId', ParseUUIDPipe) anexoId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<UrlAnexoTarefa> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseIsolada(usuarioAtual, empresa);
    return this.obterUrlAnexoTarefa.executar(id, anexoId, empresaId);
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  /** Nunca confia no `:quadroId` do path sozinho -- sempre revalida que pertence à `empresaId` da rota. */
  private async buscarQuadroOuFalhar(quadroId: string, empresaId: string): Promise<void> {
    const quadro = await this.listarQuadros.executar(empresaId);
    if (!quadro.some((q) => q.id === quadroId)) {
      throw new NotFoundException('Quadro não encontrado nesta empresa');
    }
  }

  /** `quadroId` é SEMPRE derivado da coluna informada (nunca aceito cru do body) -- Zero Trust. */
  private async resolverQuadroDaColuna(colunaId: string, empresaId: string): Promise<string> {
    const quadros = await this.listarQuadros.executar(empresaId);
    for (const quadro of quadros) {
      if (quadro.colunas.some((coluna) => coluna.id === colunaId)) {
        return quadro.id;
      }
    }
    throw new NotFoundException('Coluna não encontrada nesta empresa');
  }

  /**
   * Único quadro de autoridade deste módulo -- plataforma sempre; contador só na própria
   * `interna_contador` (nunca numa empresa-cliente da carteira); empresa só na própria.
   * Nunca "contador agindo em nome de uma empresa-cliente" (isso é o padrão de protocolos,
   * deliberadamente NÃO replicado aqui -- quadro de tarefas é sempre do dono do vínculo).
   */
  private exigirPosseIsolada(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;
    if (usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId && empresa.tipo === 'interna_contador') return;
    if (usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id) return;
    throw new ForbiddenException('Sem autoridade sobre o quadro de tarefas desta empresa');
  }

  /** Configurar quadro/coluna é restrito ao DONO (não operador), mesmo dentro do próprio vínculo. */
  private exigirDonoDoQuadro(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    this.exigirPosseIsolada(usuarioAtual, empresa);
    const papeisDeDono: string[] = [Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO];
    if (!papeisDeDono.includes(usuarioAtual.papel)) {
      throw new ForbiddenException('Só o dono do quadro configura quadros/colunas');
    }
  }
}
