import { BadRequestException, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { Balancete, ObterBalanceteUseCase } from '../aplicacao/casos-de-uso/obter-balancete.usecase';
import { BalancoPatrimonial, ObterBalancoPatrimonialUseCase } from '../aplicacao/casos-de-uso/obter-balanco-patrimonial.usecase';
import { Dre, ObterDreUseCase } from '../aplicacao/casos-de-uso/obter-dre.usecase';
import { ObterFluxoCaixaUseCase, FluxoCaixa } from '../aplicacao/casos-de-uso/obter-fluxo-caixa.usecase';
import { ContaRazao, ObterRazaoUseCase } from '../aplicacao/casos-de-uso/obter-razao.usecase';

@Controller('empresas/:empresaId/relatorios')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
@ExigirPermissao('relatorios:visualizar')
export class RelatoriosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly obterBalancete: ObterBalanceteUseCase,
    private readonly obterBalancoPatrimonial: ObterBalancoPatrimonialUseCase,
    private readonly obterDre: ObterDreUseCase,
    private readonly obterRazao: ObterRazaoUseCase,
    private readonly obterFluxoCaixa: ObterFluxoCaixaUseCase,
  ) {}

  @Get('balancete')
  async balancete(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('dataInicio') dataInicio: string | undefined,
    @Query('dataFim') dataFim: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Balancete> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    this.exigirPeriodo(dataInicio, dataFim);
    return this.obterBalancete.executar(empresaId, dataInicio!, dataFim!);
  }

  @Get('balanco-patrimonial')
  async balancoPatrimonial(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('dataFim') dataFim: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<BalancoPatrimonial> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    if (!dataFim) throw new BadRequestException('dataFim é obrigatória');
    return this.obterBalancoPatrimonial.executar(empresaId, dataFim);
  }

  @Get('dre')
  async dre(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('dataInicio') dataInicio: string | undefined,
    @Query('dataFim') dataFim: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Dre> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    this.exigirPeriodo(dataInicio, dataFim);
    return this.obterDre.executar(empresaId, dataInicio!, dataFim!);
  }

  @Get('razao')
  async razao(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('dataInicio') dataInicio: string | undefined,
    @Query('dataFim') dataFim: string | undefined,
    @Query('contaId') contaId: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ContaRazao[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    this.exigirPeriodo(dataInicio, dataFim);
    return this.obterRazao.executar(empresaId, dataInicio!, dataFim!, contaId);
  }

  @Get('fluxo-caixa')
  async fluxoCaixa(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('dataInicio') dataInicio: string | undefined,
    @Query('dataFim') dataFim: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<FluxoCaixa> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    this.exigirPeriodo(dataInicio, dataFim);
    return this.obterFluxoCaixa.executar(empresaId, dataInicio!, dataFim!);
  }

  private exigirPeriodo(dataInicio: string | undefined, dataFim: string | undefined): void {
    if (!dataInicio || !dataFim) throw new BadRequestException('dataInicio e dataFim são obrigatórias');
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  /** Leitura: contador dono, usuário da própria empresa, ou plataforma -- mesmo critério de lancamentos-contabeis. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
