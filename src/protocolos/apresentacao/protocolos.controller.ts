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
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
import { AtualizarProtocoloUseCase } from '../aplicacao/casos-de-uso/atualizar-protocolo.usecase';
import { AvancarStatusProtocoloUseCase } from '../aplicacao/casos-de-uso/avancar-status-protocolo.usecase';
import { CancelarOuMarcarProblemaProtocoloUseCase } from '../aplicacao/casos-de-uso/cancelar-ou-marcar-problema-protocolo.usecase';
import { CriarProtocoloUseCase } from '../aplicacao/casos-de-uso/criar-protocolo.usecase';
import { ExcluirProtocoloUseCase } from '../aplicacao/casos-de-uso/excluir-protocolo.usecase';
import { ListarProtocolosUseCase } from '../aplicacao/casos-de-uso/listar-protocolos.usecase';
import { ObterProtocoloUseCase } from '../aplicacao/casos-de-uso/obter-protocolo.usecase';
import { ObterUrlAnexoUseCase, UrlAnexo } from '../aplicacao/casos-de-uso/obter-url-anexo.usecase';
import { ObterUrlFotoEntregaUseCase } from '../aplicacao/casos-de-uso/obter-url-foto-entrega.usecase';
import { RegistrarEntregaProtocoloUseCase } from '../aplicacao/casos-de-uso/registrar-entrega-protocolo.usecase';
import { Protocolo, ProtocoloComAnexos } from '../aplicacao/portas/protocolos-repositorio.port';
import { AtualizarProtocoloDto } from './dto/atualizar-protocolo.dto';
import { AvancarStatusProtocoloDto } from './dto/avancar-status-protocolo.dto';
import { CancelarProblemaProtocoloDto } from './dto/cancelar-problema-protocolo.dto';
import { CriarProtocoloDto } from './dto/criar-protocolo.dto';
import { RegistrarEntregaProtocoloDto } from './dto/registrar-entrega-protocolo.dto';

const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024; // 10MB por arquivo -- documento/foto, generoso o suficiente

@Controller('empresas/:empresaId/protocolos')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard, ModulosGuard)
@ExigirModulo('protocolos')
export class ProtocolosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarProtocolo: CriarProtocoloUseCase,
    private readonly listarProtocolos: ListarProtocolosUseCase,
    private readonly obterProtocolo: ObterProtocoloUseCase,
    private readonly atualizarProtocolo: AtualizarProtocoloUseCase,
    private readonly avancarStatusProtocolo: AvancarStatusProtocoloUseCase,
    private readonly registrarEntregaProtocolo: RegistrarEntregaProtocoloUseCase,
    private readonly cancelarOuMarcarProblema: CancelarOuMarcarProblemaProtocoloUseCase,
    private readonly excluirProtocolo: ExcluirProtocoloUseCase,
    private readonly obterUrlAnexo: ObterUrlAnexoUseCase,
    private readonly obterUrlFotoEntrega: ObterUrlFotoEntregaUseCase,
  ) {}

  @Get()
  @ExigirPermissao('protocolos:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('status') status: Protocolo['status'] | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Protocolo[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarProtocolos.executar(empresaId, status ? { status } : undefined);
  }

  @Get(':id')
  @ExigirPermissao('protocolos:visualizar')
  async obter(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ProtocoloComAnexos> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterProtocolo.executar(id, empresaId);
  }

  @Post()
  @ExigirPermissao('protocolos:criar')
  @UseInterceptors(FilesInterceptor('anexos', 10, { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UploadedFiles() anexos: Express.Multer.File[] | undefined,
    @Body() dto: CriarProtocoloDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    return this.criarProtocolo.executar({
      empresaId,
      clienteId: dto.clienteId,
      titulo: dto.titulo,
      descricao: dto.descricao ?? null,
      linkTarefa: dto.linkTarefa ?? null,
      criadoPor: usuarioAtual.id,
      // Claims do JWT (SupabaseAuthGuard) só têm id/papel/contadorId/empresaId -- sem
      // nome de exibição. Simplificação deliberada: fica null por ora (não crítico,
      // o autor real já está em `criado_por` e no log de auditoria).
      usuarioCriadorNome: null,
      anexos: (anexos ?? []).map((arquivo) => ({
        nomeOriginal: arquivo.originalname,
        buffer: arquivo.buffer,
        contentType: arquivo.mimetype,
      })),
    });
  }

  @Patch(':id')
  @ExigirPermissao('protocolos:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarProtocoloDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarProtocolo.executar(id, empresaId, dto, usuarioAtual.id);
    return { ok: true };
  }

  @Patch(':id/avancar-status')
  @ExigirPermissao('protocolos:editar')
  async avancarStatus(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AvancarStatusProtocoloDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.avancarStatusProtocolo.executar(id, empresaId, dto.status, usuarioAtual.id);
    return { ok: true };
  }

  @Post(':id/entrega')
  @ExigirPermissao('protocolos:editar')
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async registrarEntrega(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() foto: Express.Multer.File | undefined,
    @Body() dto: RegistrarEntregaProtocoloDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    if (!foto) {
      throw new NotFoundException('Foto do protocolo assinado (campo "foto") é obrigatória');
    }

    await this.registrarEntregaProtocolo.executar({
      protocoloId: id,
      empresaId,
      usuarioId: usuarioAtual.id,
      nomeRespRecebimento: dto.nomeRespRecebimento,
      dataRecebimento: dto.dataRecebimento,
      foto: { nomeOriginal: foto.originalname, buffer: foto.buffer, contentType: foto.mimetype },
    });
    return { ok: true };
  }

  @Post(':id/cancelar')
  @ExigirPermissao('protocolos:editar')
  async cancelarOuProblema(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelarProblemaProtocoloDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.cancelarOuMarcarProblema.executar(id, empresaId, dto.status, dto.observacao, usuarioAtual.id);
    return { ok: true };
  }

  @Delete(':id')
  @ExigirPermissao('protocolos:excluir')
  async excluir(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirProtocolo.executar(id, empresaId, usuarioAtual.id);
    return { ok: true };
  }

  @Get(':id/anexos/:anexoId/url')
  @ExigirPermissao('protocolos:visualizar')
  async urlAnexo(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('anexoId', ParseUUIDPipe) anexoId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<UrlAnexo> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterUrlAnexo.executar(id, anexoId, empresaId);
  }

  @Get(':id/foto-entrega/url')
  @ExigirPermissao('protocolos:visualizar')
  async urlFotoEntrega(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<UrlAnexo> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterUrlFotoEntrega.executar(id, empresaId);
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }

  private exigirPosseDeContador(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;
    if (usuarioAtual.contadorId !== empresa.contadorId) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
