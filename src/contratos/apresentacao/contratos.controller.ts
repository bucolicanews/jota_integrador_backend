import { Body, Controller, Delete, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { ExigirModulo } from '../../common/modulos/exigir-modulo.decorator';
import { ModulosGuard } from '../../common/modulos/modulos.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AtualizarContratoUseCase } from '../aplicacao/casos-de-uso/atualizar-contrato.usecase';
import { AtualizarModeloContratoUseCase } from '../aplicacao/casos-de-uso/atualizar-modelo-contrato.usecase';
import { BloquearContratoUseCase } from '../aplicacao/casos-de-uso/bloquear-contrato.usecase';
import { CriarContratoUseCase } from '../aplicacao/casos-de-uso/criar-contrato.usecase';
import { CriarModeloContratoUseCase } from '../aplicacao/casos-de-uso/criar-modelo-contrato.usecase';
import { DesbloquearContratoUseCase } from '../aplicacao/casos-de-uso/desbloquear-contrato.usecase';
import { ExcluirContratoUseCase } from '../aplicacao/casos-de-uso/excluir-contrato.usecase';
import { ExcluirModeloContratoUseCase } from '../aplicacao/casos-de-uso/excluir-modelo-contrato.usecase';
import { GerarLinkAssinaturaUseCase } from '../aplicacao/casos-de-uso/gerar-link-assinatura.usecase';
import { ListarContratosUseCase } from '../aplicacao/casos-de-uso/listar-contratos.usecase';
import { ListarModelosContratoUseCase } from '../aplicacao/casos-de-uso/listar-modelos-contrato.usecase';
import { ObterCatalogoTagsUseCase } from '../aplicacao/casos-de-uso/obter-catalogo-tags.usecase';
import { ObterConfiguracaoContratosUseCase } from '../aplicacao/casos-de-uso/obter-configuracao-contratos.usecase';
import { ObterContratoUseCase } from '../aplicacao/casos-de-uso/obter-contrato.usecase';
import { ObterModeloContratoUseCase } from '../aplicacao/casos-de-uso/obter-modelo-contrato.usecase';
import { ObterUrlSelfieUseCase } from '../aplicacao/casos-de-uso/obter-url-selfie.usecase';
import { PreVisualizarContratoUseCase } from '../aplicacao/casos-de-uso/pre-visualizar-contrato.usecase';
import { DadosRegistrarAditivo, RegistrarAditivoUseCase } from '../aplicacao/casos-de-uso/registrar-aditivo.usecase';
import { SalvarConfiguracaoContratosUseCase } from '../aplicacao/casos-de-uso/salvar-configuracao-contratos.usecase';
import { ContratoGerado, ModeloContrato } from '../aplicacao/portas/contratos-repositorio.port';
import { StatusContrato } from '../dominio/contrato';
import { AtualizarContratoDto } from './dto/atualizar-contrato.dto';
import { AtualizarModeloContratoDto } from './dto/atualizar-modelo-contrato.dto';
import { CriarContratoDto } from './dto/criar-contrato.dto';
import { CriarModeloContratoDto } from './dto/criar-modelo-contrato.dto';
import { PreVisualizarContratoDto } from './dto/pre-visualizar-contrato.dto';
import { RegistrarAditivoDto } from './dto/registrar-aditivo.dto';
import { SalvarConfiguracaoContratosDto } from './dto/salvar-configuracao-contratos.dto';

@Controller('empresas/:empresaId/contratos')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard, ModulosGuard)
@ExigirModulo('contratos')
export class ContratosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarModelo: CriarModeloContratoUseCase,
    private readonly listarModelos: ListarModelosContratoUseCase,
    private readonly obterModelo: ObterModeloContratoUseCase,
    private readonly atualizarModelo: AtualizarModeloContratoUseCase,
    private readonly excluirModelo: ExcluirModeloContratoUseCase,
    private readonly obterCatalogoTags: ObterCatalogoTagsUseCase,
    private readonly obterConfiguracao: ObterConfiguracaoContratosUseCase,
    private readonly salvarConfiguracao: SalvarConfiguracaoContratosUseCase,
    private readonly preVisualizar: PreVisualizarContratoUseCase,
    private readonly criarContrato: CriarContratoUseCase,
    private readonly listarContratos: ListarContratosUseCase,
    private readonly obterContrato: ObterContratoUseCase,
    private readonly atualizarContrato: AtualizarContratoUseCase,
    private readonly excluirContrato: ExcluirContratoUseCase,
    private readonly bloquearContrato: BloquearContratoUseCase,
    private readonly desbloquearContrato: DesbloquearContratoUseCase,
    private readonly registrarAditivo: RegistrarAditivoUseCase,
    private readonly gerarLinkAssinatura: GerarLinkAssinaturaUseCase,
    private readonly obterUrlSelfie: ObterUrlSelfieUseCase,
  ) {}

  @Get('modelos')
  @ExigirPermissao('contratos:visualizar')
  async listarModelosContrato(@Param('empresaId', ParseUUIDPipe) empresaId: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<ModeloContrato[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarModelos.executar(empresaId);
  }

  @Post('modelos')
  @ExigirPermissao('contratos:criar')
  async criarModeloContrato(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarModeloContratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ModeloContrato> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarModelo.executar({ empresaId, ...dto });
  }

  @Get('modelos/:id')
  @ExigirPermissao('contratos:visualizar')
  async obterModeloContrato(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ModeloContrato> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterModelo.executar(id, empresaId);
  }

  @Patch('modelos/:id')
  @ExigirPermissao('contratos:editar')
  async atualizarModeloContrato(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarModeloContratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarModelo.executar(id, empresaId, dto);
    return { ok: true };
  }

  @Delete('modelos/:id')
  @ExigirPermissao('contratos:excluir')
  async excluirModeloContrato(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirModelo.executar(id, empresaId);
    return { ok: true };
  }

  @Get('tags')
  @ExigirPermissao('contratos:visualizar')
  async catalogoTags(@Param('empresaId', ParseUUIDPipe) empresaId: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterCatalogoTags.executar(empresaId);
  }

  @Get('configuracao')
  @ExigirPermissao('contratos:visualizar')
  async obterConfiguracaoContratos(@Param('empresaId', ParseUUIDPipe) empresaId: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterConfiguracao.executar(empresaId);
  }

  @Put('configuracao')
  @ExigirPermissao('contratos:editar')
  async salvarConfiguracaoContratos(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: SalvarConfiguracaoContratosDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.salvarConfiguracao.executar(empresaId, dto);
  }

  @Post('preview')
  @ExigirPermissao('contratos:criar')
  async preVisualizarContrato(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: PreVisualizarContratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.preVisualizar.executar({
      empresaId,
      modeloId: dto.modeloId,
      clienteId: dto.clienteId,
      valoresTagsManuais: dto.valoresTagsManuais,
      valorTotal: dto.valorTotal ?? null,
      quantidadeParcelas: dto.quantidadeParcelas ?? null,
    });
  }

  @Get()
  @ExigirPermissao('contratos:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('status') status: StatusContrato | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ContratoGerado[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarContratos.executar(empresaId, status ? { status } : undefined);
  }

  @Post()
  @ExigirPermissao('contratos:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarContratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ContratoGerado> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarContrato.executar({
      empresaId,
      modeloId: dto.modeloId,
      clienteId: dto.clienteId ?? null,
      empresaContraparteId: dto.empresaContraparteId ?? null,
      titulo: dto.titulo,
      valoresTagsManuais: dto.valoresTagsManuais,
      valorTotal: dto.valorTotal ?? null,
      parcelamento: dto.parcelamento ?? null,
      criadoPor: usuarioAtual.id,
    });
  }

  @Get(':id')
  @ExigirPermissao('contratos:visualizar')
  async obter(@Param('empresaId', ParseUUIDPipe) empresaId: string, @Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterContrato.executar(id, empresaId);
  }

  @Patch(':id')
  @ExigirPermissao('contratos:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarContratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarContrato.executar(id, empresaId, dto, usuarioAtual.id);
    return { ok: true };
  }

  @Delete(':id')
  @ExigirPermissao('contratos:excluir')
  async excluir(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirContrato.executar(id, empresaId, usuarioAtual.id);
    return { ok: true };
  }

  @Post(':id/bloquear')
  @ExigirPermissao('contratos:editar')
  async bloquear(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.bloquearContrato.executar(id, empresaId, usuarioAtual.id);
    return { ok: true };
  }

  @Post(':id/desbloquear')
  @ExigirPermissao('contratos:editar')
  async desbloquear(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.desbloquearContrato.executar(id, empresaId, usuarioAtual.id);
    return { ok: true };
  }

  @Post(':id/aditivos')
  @ExigirPermissao('contratos:editar')
  async criarAditivo(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarAditivoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    const dados: DadosRegistrarAditivo = {
      contratoId: id,
      empresaId,
      descricao: dto.descricao,
      mudancaFinanceira: dto.mudancaFinanceira ?? null,
      criadoPor: usuarioAtual.id,
    };
    return this.registrarAditivo.executar(dados);
  }

  @Post(':id/link-assinatura')
  @ExigirPermissao('contratos:editar')
  async linkAssinatura(@Param('empresaId', ParseUUIDPipe) empresaId: string, @Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.gerarLinkAssinatura.executar(id, empresaId);
  }

  @Get(':id/selfie-url')
  @ExigirPermissao('contratos:visualizar')
  async urlSelfie(@Param('empresaId', ParseUUIDPipe) empresaId: string, @Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterUrlSelfie.executar(id, empresaId);
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
