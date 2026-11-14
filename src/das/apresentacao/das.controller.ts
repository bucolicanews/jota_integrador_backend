import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { ExigirModulo } from '../../common/modulos/exigir-modulo.decorator';
import { ModulosGuard } from '../../common/modulos/modulos.guard';
import { EMPRESAS_REPOSITORIO, Empresa, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { DasItem } from '../dominio/das';
import { ConfiguracaoLancamentosDas } from '../aplicacao/portas/das-repositorio.port';
import { DasListado, ListarDasUseCase } from '../aplicacao/casos-de-uso/listar-das.usecase';
import { GerarSegundaViaDasUseCase } from '../aplicacao/casos-de-uso/gerar-segunda-via-das.usecase';
import { ObterUrlPdfDasUseCase } from '../aplicacao/casos-de-uso/obter-url-pdf-das.usecase';
import { ObterUrlReciboDasUseCase } from '../aplicacao/casos-de-uso/obter-url-recibo-das.usecase';
import { ObterUrlDeclaracaoDasUseCase } from '../aplicacao/casos-de-uso/obter-url-declaracao-das.usecase';
import { EstimarSincronizacaoDasUseCase, ResultadoEstimativa } from '../aplicacao/casos-de-uso/estimar-sincronizacao-das.usecase';
import { SincronizarDasEmpresaUseCase } from '../aplicacao/casos-de-uso/sincronizar-das-empresa.usecase';
import { BuscarConfiguracaoLancamentosDasUseCase } from '../aplicacao/casos-de-uso/buscar-configuracao-lancamentos-das.usecase';
import { SalvarConfiguracaoLancamentosDasUseCase } from '../aplicacao/casos-de-uso/salvar-configuracao-lancamentos-das.usecase';
import { ListarDasPendentesBaixaUseCase } from '../aplicacao/casos-de-uso/listar-das-pendentes-baixa.usecase';
import { ResolverBaixaDasUseCase } from '../aplicacao/casos-de-uso/resolver-baixa-das.usecase';
import { GerarProvisaoManualDasUseCase } from '../aplicacao/casos-de-uso/gerar-provisao-manual-das.usecase';
import { GerarSegundaViaDasDto } from './dto/gerar-segunda-via-das.dto';
import { SincronizarDasDto } from './dto/sincronizar-das.dto';
import { SalvarConfiguracaoLancamentosDasDto } from './dto/salvar-configuracao-lancamentos-das.dto';
import { ResolverBaixaDasDto } from './dto/resolver-baixa-das.dto';

@Controller('empresas/:empresaId/das')
@UseGuards(SupabaseAuthGuard, PapeisGuard, ModulosGuard)
@ExigirModulo('fiscal')
export class DasController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly listarDas: ListarDasUseCase,
    private readonly obterUrlPdf: ObterUrlPdfDasUseCase,
    private readonly obterUrlRecibo: ObterUrlReciboDasUseCase,
    private readonly obterUrlDeclaracao: ObterUrlDeclaracaoDasUseCase,
    private readonly sincronizarDasEmpresa: SincronizarDasEmpresaUseCase,
    private readonly estimarSincronizacao: EstimarSincronizacaoDasUseCase,
    private readonly gerarSegundaVia: GerarSegundaViaDasUseCase,
    private readonly buscarConfiguracaoLancamentos: BuscarConfiguracaoLancamentosDasUseCase,
    private readonly salvarConfiguracaoLancamentos: SalvarConfiguracaoLancamentosDasUseCase,
    private readonly listarPendentesBaixa: ListarDasPendentesBaixaUseCase,
    private readonly resolverBaixa: ResolverBaixaDasUseCase,
    private readonly gerarProvisaoManual: GerarProvisaoManualDasUseCase,
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

  /** Recibo de entrega da declaração (CONSDECREC15), cacheado no sync -- só Simples Nacional. */
  @Get(':dasId/recibo-url')
  async urlRecibo(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('dasId', ParseUUIDPipe) dasId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string; expiraEmSegundos: number }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.obterUrlRecibo.executar(empresaId, dasId);
  }

  /** Declaração (Programa Gerador do DAS -- Declaratório), mesma chamada CONSDECREC15 do recibo -- só Simples Nacional. */
  @Get(':dasId/declaracao-url')
  async urlDeclaracao(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('dasId', ParseUUIDPipe) dasId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string; expiraEmSegundos: number }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.obterUrlDeclaracao.executar(empresaId, dasId);
  }

  /**
   * Boleto real (código de barras), sob demanda -- sempre gera de novo no SERPRO (nunca
   * reusa um PDF salvo antes), diferente de `GET :dasId/url` (o Extrato, que é cacheado).
   */
  @Post(':dasId/segunda-via')
  async segundaVia(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('dasId', ParseUUIDPipe) dasId: string,
    @Body() dto: GerarSegundaViaDasDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string; expiraEmSegundos: number }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.gerarSegundaVia.executar(empresaId, dasId, dto.dataConsolidacao);
  }

  /** Prévia de custo em créditos ANTES de sincronizar -- nunca chama o SERPRO/debita crédito, só leitura. */
  @Get('sincronizar/estimativa')
  async estimativaSincronizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('competenciaInicio') competenciaInicio: string | undefined,
    @Query('competenciaFim') competenciaFim: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoEstimativa> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.estimarSincronizacao.executar(empresaId, { competenciaInicio, competenciaFim });
  }

  /** Sync manual sob demanda -- complementa o cron diário, sem precisar esperar por ele. */
  @Post('sincronizar')
  async sincronizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: SincronizarDasDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ competenciasNovas: number; pagamentosAtualizados: number }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.sincronizarDasEmpresa.executar(empresaId, dto);
  }

  @Get('configuracao-lancamentos')
  async obterConfiguracaoLancamentos(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ConfiguracaoLancamentosDas | null> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.buscarConfiguracaoLancamentos.executar(empresaId);
  }

  @Put('configuracao-lancamentos')
  async definirConfiguracaoLancamentos(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: SalvarConfiguracaoLancamentosDasDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<void> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.salvarConfiguracaoLancamentos.executar({
      empresaId,
      contaDebitoId: dto.contaDebitoId,
      contaCreditoId: dto.contaCreditoId,
      atualizadoPor: usuarioAtual.id,
    });
  }

  /** DAS já "pago" aguardando o contador escolher caixa/banco pra gerar a baixa contábil. */
  @Get('pendencias-baixa')
  async pendenciasBaixa(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<DasItem[]> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.listarPendentesBaixa.executar(empresaId);
  }

  @Post(':dasId/baixa')
  async baixar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('dasId', ParseUUIDPipe) dasId: string,
    @Body() dto: ResolverBaixaDasDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ lancamentoId: string }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    const lancamentoId = await this.resolverBaixa.executar({
      empresaId,
      dasId,
      tipo: dto.tipo,
      bancoId: dto.bancoId,
      resolvidoPor: usuarioAtual.id,
    });
    return { lancamentoId };
  }

  /** "Gerar lançamento" manual pra um DAS que ficou sem provisão (geralmente porque a config não existia na hora do sync) -- nunca chama SERPRO, zero crédito. */
  @Post(':dasId/provisao')
  async gerarProvisao(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('dasId', ParseUUIDPipe) dasId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ contaPagarId: string }> {
    await this.exigirPosse(empresaId, usuarioAtual);
    return this.gerarProvisaoManual.executar(empresaId, dasId);
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
