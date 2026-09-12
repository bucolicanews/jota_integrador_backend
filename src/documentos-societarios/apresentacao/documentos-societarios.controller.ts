import { Body, Controller, Delete, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { ArquivarDocumentoSocietarioUseCase } from '../aplicacao/casos-de-uso/arquivar-documento-societario.usecase';
import { AtualizarBlocoSocietarioUseCase } from '../aplicacao/casos-de-uso/atualizar-bloco-societario.usecase';
import { AtualizarDocumentoSocietarioUseCase } from '../aplicacao/casos-de-uso/atualizar-documento-societario.usecase';
import { AtualizarModeloSocietarioUseCase } from '../aplicacao/casos-de-uso/atualizar-modelo-societario.usecase';
import { CriarBlocoSocietarioUseCase } from '../aplicacao/casos-de-uso/criar-bloco-societario.usecase';
import { CriarDocumentoSocietarioUseCase } from '../aplicacao/casos-de-uso/criar-documento-societario.usecase';
import { CriarModeloSocietarioUseCase } from '../aplicacao/casos-de-uso/criar-modelo-societario.usecase';
import { ExcluirBlocoSocietarioUseCase } from '../aplicacao/casos-de-uso/excluir-bloco-societario.usecase';
import { ExcluirDocumentoSocietarioUseCase } from '../aplicacao/casos-de-uso/excluir-documento-societario.usecase';
import { ExcluirModeloSocietarioUseCase } from '../aplicacao/casos-de-uso/excluir-modelo-societario.usecase';
import { FinalizarDocumentoSocietarioUseCase } from '../aplicacao/casos-de-uso/finalizar-documento-societario.usecase';
import { ListarBlocosSocietariosUseCase } from '../aplicacao/casos-de-uso/listar-blocos-societarios.usecase';
import { ListarDocumentosSocietariosUseCase } from '../aplicacao/casos-de-uso/listar-documentos-societarios.usecase';
import { ListarModelosSocietariosUseCase } from '../aplicacao/casos-de-uso/listar-modelos-societarios.usecase';
import { ObterDocumentoSocietarioUseCase } from '../aplicacao/casos-de-uso/obter-documento-societario.usecase';
import { ObterModeloSocietarioUseCase } from '../aplicacao/casos-de-uso/obter-modelo-societario.usecase';
import { BlocoSocietario, DocumentoSocietarioGerado, ModeloSocietario } from '../aplicacao/portas/documentos-societarios-repositorio.port';
import { StatusDocumentoSocietario } from '../dominio/documento-societario';
import { AtualizarBlocoSocietarioDto } from './dto/atualizar-bloco-societario.dto';
import { AtualizarDocumentoSocietarioDto } from './dto/atualizar-documento-societario.dto';
import { AtualizarModeloSocietarioDto } from './dto/atualizar-modelo-societario.dto';
import { CriarBlocoSocietarioDto } from './dto/criar-bloco-societario.dto';
import { CriarDocumentoSocietarioDto } from './dto/criar-documento-societario.dto';
import { CriarModeloSocietarioDto } from './dto/criar-modelo-societario.dto';

@Controller('empresas/:empresaId/documentos-societarios')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class DocumentosSocietariosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarModelo: CriarModeloSocietarioUseCase,
    private readonly listarModelos: ListarModelosSocietariosUseCase,
    private readonly obterModelo: ObterModeloSocietarioUseCase,
    private readonly atualizarModelo: AtualizarModeloSocietarioUseCase,
    private readonly excluirModelo: ExcluirModeloSocietarioUseCase,
    private readonly criarBloco: CriarBlocoSocietarioUseCase,
    private readonly listarBlocos: ListarBlocosSocietariosUseCase,
    private readonly atualizarBloco: AtualizarBlocoSocietarioUseCase,
    private readonly excluirBloco: ExcluirBlocoSocietarioUseCase,
    private readonly criarDocumento: CriarDocumentoSocietarioUseCase,
    private readonly listarDocumentos: ListarDocumentosSocietariosUseCase,
    private readonly obterDocumento: ObterDocumentoSocietarioUseCase,
    private readonly atualizarDocumento: AtualizarDocumentoSocietarioUseCase,
    private readonly excluirDocumento: ExcluirDocumentoSocietarioUseCase,
    private readonly finalizarDocumento: FinalizarDocumentoSocietarioUseCase,
    private readonly arquivarDocumento: ArquivarDocumentoSocietarioUseCase,
  ) {}

  @Get('modelos')
  @ExigirPermissao('documentos_societarios:visualizar')
  async listarModelosSocietarios(@Param('empresaId', ParseUUIDPipe) empresaId: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<ModeloSocietario[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarModelos.executar(empresaId);
  }

  @Post('modelos')
  @ExigirPermissao('documentos_societarios:criar')
  async criarModeloSocietario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarModeloSocietarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ModeloSocietario> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarModelo.executar({ empresaId, ...dto });
  }

  @Get('modelos/:id')
  @ExigirPermissao('documentos_societarios:visualizar')
  async obterModeloSocietario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ModeloSocietario> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterModelo.executar(id, empresaId);
  }

  @Patch('modelos/:id')
  @ExigirPermissao('documentos_societarios:editar')
  async atualizarModeloSocietario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarModeloSocietarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarModelo.executar(id, empresaId, dto);
    return { ok: true };
  }

  @Delete('modelos/:id')
  @ExigirPermissao('documentos_societarios:excluir')
  async excluirModeloSocietario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirModelo.executar(id, empresaId);
    return { ok: true };
  }

  @Get('blocos')
  @ExigirPermissao('documentos_societarios:visualizar')
  async listarBlocosSocietarios(@Param('empresaId', ParseUUIDPipe) empresaId: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<BlocoSocietario[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarBlocos.executar(empresaId);
  }

  @Post('blocos')
  @ExigirPermissao('documentos_societarios:criar')
  async criarBlocoSocietario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarBlocoSocietarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<BlocoSocietario> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarBloco.executar({ empresaId, ...dto });
  }

  @Patch('blocos/:id')
  @ExigirPermissao('documentos_societarios:editar')
  async atualizarBlocoSocietario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarBlocoSocietarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarBloco.executar(id, empresaId, dto);
    return { ok: true };
  }

  @Delete('blocos/:id')
  @ExigirPermissao('documentos_societarios:excluir')
  async excluirBlocoSocietario(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirBloco.executar(id, empresaId);
    return { ok: true };
  }

  @Get()
  @ExigirPermissao('documentos_societarios:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('status') status: StatusDocumentoSocietario | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<DocumentoSocietarioGerado[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarDocumentos.executar(empresaId, status ? { status } : undefined);
  }

  @Post()
  @ExigirPermissao('documentos_societarios:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarDocumentoSocietarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<DocumentoSocietarioGerado> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarDocumento.executar({
      empresaId,
      modeloId: dto.modeloId,
      clienteId: dto.clienteId ?? null,
      titulo: dto.titulo,
      valoresTags: dto.valoresTags,
      dataRegistro: dto.dataRegistro ?? null,
      criadoPor: usuarioAtual.id,
    });
  }

  @Get(':id')
  @ExigirPermissao('documentos_societarios:visualizar')
  async obter(@Param('empresaId', ParseUUIDPipe) empresaId: string, @Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<DocumentoSocietarioGerado> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterDocumento.executar(id, empresaId);
  }

  @Patch(':id')
  @ExigirPermissao('documentos_societarios:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarDocumentoSocietarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarDocumento.executar(id, empresaId, dto);
    return { ok: true };
  }

  @Delete(':id')
  @ExigirPermissao('documentos_societarios:excluir')
  async excluir(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirDocumento.executar(id, empresaId);
    return { ok: true };
  }

  @Post(':id/finalizar')
  @ExigirPermissao('documentos_societarios:editar')
  async finalizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.finalizarDocumento.executar(id, empresaId);
    return { ok: true };
  }

  @Post(':id/arquivar')
  @ExigirPermissao('documentos_societarios:editar')
  async arquivar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.arquivarDocumento.executar(id, empresaId);
    return { ok: true };
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
