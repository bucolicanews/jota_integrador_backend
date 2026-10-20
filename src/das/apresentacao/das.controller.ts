import { Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { EMPRESAS_REPOSITORIO, Empresa, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { DasListado, ListarDasUseCase } from '../aplicacao/casos-de-uso/listar-das.usecase';
import { ObterUrlPdfDasUseCase } from '../aplicacao/casos-de-uso/obter-url-pdf-das.usecase';
import { SincronizarDasEmpresaUseCase } from '../aplicacao/casos-de-uso/sincronizar-das-empresa.usecase';

@Controller('empresas/:empresaId/das')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class DasController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly listarDas: ListarDasUseCase,
    private readonly obterUrlPdf: ObterUrlPdfDasUseCase,
    private readonly sincronizarDasEmpresa: SincronizarDasEmpresaUseCase,
  ) {}

  @Get()
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<DasListado[]> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.listarDas.executar(empresaId);
  }

  @Get(':dasId/url')
  async url(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('dasId', ParseUUIDPipe) dasId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string; expiraEmSegundos: number }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.obterUrlPdf.executar(empresaId, dasId);
  }

  /** Sync manual sob demanda -- complementa o cron diário, sem precisar esperar por ele. */
  @Post('sincronizar')
  async sincronizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ competenciasNovas: number; pagamentosAtualizados: number }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.sincronizarDasEmpresa.executar(empresaId);
  }

  private async exigirPosse(empresaId: string, usuarioAtual: UsuarioAutenticado): Promise<void> {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;

    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    this.checarPosse(usuarioAtual, empresa);
  }

  /** Mesmo padrão de posse de CaixaPostalController/SerproController. */
  private checarPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
