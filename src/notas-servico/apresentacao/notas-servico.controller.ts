import { Body, Controller, ForbiddenException, Get, Header, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AprovarNotaServicoUseCase } from '../aplicacao/casos-de-uso/aprovar-nota-servico.usecase';
import { GerarDanfsePdfUseCase } from '../aplicacao/casos-de-uso/gerar-danfse-pdf.usecase';
import { ListarNotasServicoPendentesUseCase } from '../aplicacao/casos-de-uso/listar-notas-servico-pendentes.usecase';
import { ObterDetalheNotaServicoUseCase } from '../aplicacao/casos-de-uso/obter-detalhe-nota-servico.usecase';
import { RejeitarNotaServicoUseCase } from '../aplicacao/casos-de-uso/rejeitar-nota-servico.usecase';
import { NotaServicoResumo } from '../aplicacao/portas/notas-servico-repositorio.port';
import { RejeitarNotaServicoDto } from './dto/rejeitar-nota-servico.dto';

@Controller('empresas/:empresaId/notas-servico')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class NotasServicoController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly listarPendentes: ListarNotasServicoPendentesUseCase,
    private readonly obterDetalhe: ObterDetalheNotaServicoUseCase,
    private readonly aprovarNotaServico: AprovarNotaServicoUseCase,
    private readonly rejeitarNotaServico: RejeitarNotaServicoUseCase,
    private readonly gerarDanfsePdf: GerarDanfsePdfUseCase,
  ) {}

  @Get('pendentes')
  @ExigirPermissao('notas_servico:visualizar')
  async listarPendentesRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<NotaServicoResumo[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarPendentes.executar(empresaId);
  }

  @Get(':id')
  @ExigirPermissao('notas_servico:visualizar')
  async obterDetalheRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<NotaServicoResumo> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterDetalhe.executar(id, empresaId);
  }

  @Get(':id/danfse')
  @ExigirPermissao('notas_servico:visualizar')
  @Header('Content-Type', 'application/pdf')
  async gerarDanfseRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('situacao') situacao: string | undefined,
    @Query('canhoto') canhoto: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<StreamableFile> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    const situacaoNumerica = situacao !== undefined ? (Number(situacao) as 0 | 1 | 2) : undefined;
    const pdf = await this.gerarDanfsePdf.executar(id, empresaId, {
      situacao: situacaoNumerica,
      canhoto: canhoto !== undefined ? canhoto === 'true' : undefined,
    });
    return new StreamableFile(pdf);
  }

  @Post(':id/aprovar')
  @ExigirPermissao('notas_servico:editar')
  async aprovarRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    await this.aprovarNotaServico.executar(id, empresaId, usuarioAtual.id);
    return { ok: true };
  }

  @Post(':id/rejeitar')
  @ExigirPermissao('notas_servico:editar')
  async rejeitarRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejeitarNotaServicoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    await this.rejeitarNotaServico.executar(id, empresaId, dto.motivoRejeicao, usuarioAtual.id);
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
}
