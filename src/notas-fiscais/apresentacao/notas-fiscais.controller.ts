import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AprovarNotaFiscalUseCase } from '../aplicacao/casos-de-uso/aprovar-nota-fiscal.usecase';
import { BuscarConfiguracaoLancamentosNfUseCase } from '../aplicacao/casos-de-uso/buscar-configuracao-lancamentos-nf.usecase';
import { GerarTokenAgenteUseCase } from '../aplicacao/casos-de-uso/gerar-token-agente.usecase';
import { ListarNotasFiscaisPendentesUseCase } from '../aplicacao/casos-de-uso/listar-notas-fiscais-pendentes.usecase';
import { ListarItensApuracaoTributariaUseCase, ItemApuracaoTributaria } from '../aplicacao/casos-de-uso/listar-itens-apuracao-tributaria.usecase';
import { ListarNotasFiscaisPorPeriodoUseCase } from '../aplicacao/casos-de-uso/listar-notas-fiscais-por-periodo.usecase';
import { ObterDetalheNotaFiscalUseCase } from '../aplicacao/casos-de-uso/obter-detalhe-nota-fiscal.usecase';
import { ObterStatusAgenteUseCase } from '../aplicacao/casos-de-uso/obter-status-agente.usecase';
import { ObterUrlDownloadAgenteUseCase } from '../aplicacao/casos-de-uso/obter-url-download-agente.usecase';
import { ObterUrlXmlNotaFiscalUseCase } from '../aplicacao/casos-de-uso/obter-url-xml-nota-fiscal.usecase';
import { RejeitarNotaFiscalUseCase } from '../aplicacao/casos-de-uso/rejeitar-nota-fiscal.usecase';
import { RevogarTokenAgenteUseCase } from '../aplicacao/casos-de-uso/revogar-token-agente.usecase';
import { SalvarConfiguracaoLancamentosNfUseCase } from '../aplicacao/casos-de-uso/salvar-configuracao-lancamentos-nf.usecase';
import { AgenteNotasFiscais } from '../aplicacao/portas/agentes-notas-fiscais-repositorio.port';
import { ConfiguracaoLancamentosNf, NotaFiscalDetalhe, NotaFiscalResumo } from '../aplicacao/portas/notas-fiscais-repositorio.port';
import { RejeitarNotaFiscalDto } from './dto/rejeitar-nota-fiscal.dto';
import { SalvarConfiguracaoLancamentosNfDto } from './dto/salvar-configuracao-lancamentos-nf.dto';

@Controller('empresas/:empresaId/notas-fiscais')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class NotasFiscaisController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly listarPendentes: ListarNotasFiscaisPendentesUseCase,
    private readonly listarPorPeriodo: ListarNotasFiscaisPorPeriodoUseCase,
    private readonly obterDetalhe: ObterDetalheNotaFiscalUseCase,
    private readonly obterUrlXml: ObterUrlXmlNotaFiscalUseCase,
    private readonly aprovarNotaFiscal: AprovarNotaFiscalUseCase,
    private readonly rejeitarNotaFiscal: RejeitarNotaFiscalUseCase,
    private readonly buscarConfiguracaoLancamentos: BuscarConfiguracaoLancamentosNfUseCase,
    private readonly salvarConfiguracaoLancamentos: SalvarConfiguracaoLancamentosNfUseCase,
    private readonly gerarTokenAgente: GerarTokenAgenteUseCase,
    private readonly revogarTokenAgente: RevogarTokenAgenteUseCase,
    private readonly obterStatusAgente: ObterStatusAgenteUseCase,
    private readonly obterUrlDownloadAgente: ObterUrlDownloadAgenteUseCase,
    private readonly listarItensApuracaoTributaria: ListarItensApuracaoTributariaUseCase,
  ) {}

  @Get('apuracao-tributaria')
  @ExigirPermissao('notas_fiscais:visualizar')
  async obterApuracaoTributariaRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ItemApuracaoTributaria[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarItensApuracaoTributaria.executar(empresaId, dataInicio, dataFim);
  }

  @Get('agente/download')
  @ExigirPermissao('notas_fiscais:visualizar')
  async obterUrlDownloadAgenteRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string; expiraEmSegundos: number }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterUrlDownloadAgente.executar();
  }

  @Get('painel')
  @ExigirPermissao('notas_fiscais:visualizar')
  async obterPainelRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<NotaFiscalResumo[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarPorPeriodo.executar(empresaId, dataInicio, dataFim);
  }

  @Get('agente/status')
  @ExigirPermissao('notas_fiscais:visualizar')
  async obterStatusAgenteRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<AgenteNotasFiscais | null> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterStatusAgente.executar(empresaId);
  }

  @Get('pendentes')
  @ExigirPermissao('notas_fiscais:visualizar')
  async listarPendentesRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<NotaFiscalResumo[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarPendentes.executar(empresaId);
  }

  @Get('configuracao-lancamentos')
  @ExigirPermissao('notas_fiscais:visualizar')
  async obterConfiguracaoLancamentosRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ConfiguracaoLancamentosNf | null> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.buscarConfiguracaoLancamentos.executar(empresaId);
  }

  @Put('configuracao-lancamentos')
  @ExigirPermissao('notas_fiscais:editar')
  async salvarConfiguracaoLancamentosRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: SalvarConfiguracaoLancamentosNfDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    await this.salvarConfiguracaoLancamentos.executar({
      empresaId,
      contaPatrimonialEntradaId: dto.contaPatrimonialEntradaId,
      contaResultadoEntradaId: dto.contaResultadoEntradaId,
      contaPatrimonialSaidaId: dto.contaPatrimonialSaidaId,
      contaResultadoSaidaId: dto.contaResultadoSaidaId,
      contaRecebimentoVistaId: dto.contaRecebimentoVistaId ?? null,
      atualizadoPor: usuarioAtual.id,
    });
    return { ok: true };
  }

  @Post('agente/token')
  @ExigirPermissao('notas_fiscais:editar')
  async gerarTokenAgenteRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ token: string }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.gerarTokenAgente.executar(empresaId, usuarioAtual.id);
  }

  @Post('agente/token/revogar')
  @ExigirPermissao('notas_fiscais:editar')
  async revogarTokenAgenteRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    await this.revogarTokenAgente.executar(empresaId, usuarioAtual.id);
    return { ok: true };
  }

  @Get(':id')
  @ExigirPermissao('notas_fiscais:visualizar')
  async obterDetalheRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<NotaFiscalDetalhe> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterDetalhe.executar(id, empresaId);
  }

  @Get(':id/xml-url')
  @ExigirPermissao('notas_fiscais:visualizar')
  async obterUrlXmlRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string; expiraEmSegundos: number }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterUrlXml.executar(id, empresaId);
  }

  @Post(':id/aprovar')
  @ExigirPermissao('notas_fiscais:editar')
  async aprovarRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ contaPagarId: string | null; contaReceberId: string | null }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.aprovarNotaFiscal.executar(id, empresaId, usuarioAtual.id);
  }

  @Post(':id/rejeitar')
  @ExigirPermissao('notas_fiscais:editar')
  async rejeitarRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejeitarNotaFiscalDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    await this.rejeitarNotaFiscal.executar(id, empresaId, dto.motivoRejeicao, usuarioAtual.id);
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
