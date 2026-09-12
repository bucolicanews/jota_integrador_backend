import { Body, Controller, Delete, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AtualizarHistoricoUseCase } from '../aplicacao/casos-de-uso/atualizar-historico.usecase';
import { CriarHistoricoUseCase } from '../aplicacao/casos-de-uso/criar-historico.usecase';
import { ExcluirHistoricoUseCase } from '../aplicacao/casos-de-uso/excluir-historico.usecase';
import { ListarHistoricosUseCase } from '../aplicacao/casos-de-uso/listar-historicos.usecase';
import { Historico } from '../aplicacao/portas/historicos-repositorio.port';
import { AtualizarHistoricoDto } from './dto/atualizar-historico.dto';
import { CriarHistoricoDto } from './dto/criar-historico.dto';

@Controller('empresas/:empresaId/historicos')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class HistoricosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarHistorico: CriarHistoricoUseCase,
    private readonly listarHistoricos: ListarHistoricosUseCase,
    private readonly atualizarHistorico: AtualizarHistoricoUseCase,
    private readonly excluirHistorico: ExcluirHistoricoUseCase,
  ) {}

  @Get()
  @ExigirPermissao('historicos:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Historico[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarHistoricos.executar(empresaId);
  }

  @Post()
  @ExigirPermissao('historicos:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarHistoricoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Historico> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarHistorico.executar({ empresaId, ...dto });
  }

  @Patch(':id')
  @ExigirPermissao('historicos:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarHistoricoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarHistorico.executar(id, empresaId, dto);
    return { ok: true };
  }

  @Delete(':id')
  @ExigirPermissao('historicos:excluir')
  async excluir(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirHistorico.executar(id, empresaId);
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
