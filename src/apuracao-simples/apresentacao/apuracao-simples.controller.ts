import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { CalcularApuracaoSimplesUseCase, ResultadoApuracaoSimples } from '../aplicacao/casos-de-uso/calcular-apuracao-simples.usecase';
import { CalcularFatorRUseCase, ResultadoFatorR } from '../aplicacao/casos-de-uso/calcular-fator-r.usecase';
import { CalcularRbt12UseCase, ResultadoRbt12 } from '../aplicacao/casos-de-uso/calcular-rbt12.usecase';
import { ConsultarRtcSimplesNacionalUseCase, ResultadoRtcSimplesNacional } from '../aplicacao/casos-de-uso/consultar-rtc-simples-nacional.usecase';
import { DefinirReceitaMensalUseCase } from '../aplicacao/casos-de-uso/definir-receita-mensal.usecase';
import { CATALOGO_ATIVIDADES_SERVICO, ChaveAtividadeServico } from '../dominio/catalogo-anexos-simples';
import { ReceitaMensal } from '../dominio/receita-mensal';
import { DefinirReceitaMensalDto } from './dto/definir-receita-mensal.dto';

// Mesmo recurso de permissão de notas_fiscais -- apuração do Simples é a mesma tela/fluxo,
// não vale a pena um catálogo de permissão novo só pra isso.
@Controller('empresas/:empresaId/apuracao-simples')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class ApuracaoSimplesController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly calcularRbt12: CalcularRbt12UseCase,
    private readonly calcularFatorR: CalcularFatorRUseCase,
    private readonly calcularApuracaoSimples: CalcularApuracaoSimplesUseCase,
    private readonly definirReceitaMensal: DefinirReceitaMensalUseCase,
    private readonly consultarRtcSimplesNacional: ConsultarRtcSimplesNacionalUseCase,
  ) {}

  @Get('catalogo-atividades-servico')
  @ExigirPermissao('notas_fiscais:visualizar')
  async listarCatalogoAtividadesServicoRota(): Promise<{ chave: string; rotulo: string }[]> {
    return Object.entries(CATALOGO_ATIVIDADES_SERVICO).map(([chave, info]) => ({ chave, rotulo: info.rotulo }));
  }

  @Get('rbt12')
  @ExigirPermissao('notas_fiscais:visualizar')
  async calcularRbt12Rota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('competenciaReferencia') competenciaReferencia: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoRbt12> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.calcularRbt12.executar(empresaId, competenciaReferencia);
  }

  @Get('fator-r')
  @ExigirPermissao('notas_fiscais:visualizar')
  async calcularFatorRRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('competenciaReferencia') competenciaReferencia: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoFatorR> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.calcularFatorR.executar(empresaId, competenciaReferencia);
  }

  @Get('apuracao')
  @ExigirPermissao('notas_fiscais:visualizar')
  async calcularApuracaoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('competencia') competencia: string,
    @Query('chaveAtividadeServico') chaveAtividadeServico: ChaveAtividadeServico | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoApuracaoSimples> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.calcularApuracaoSimples.executar(empresaId, competencia, chaveAtividadeServico);
  }

  @Get('rtc-simples-nacional')
  @ExigirPermissao('notas_fiscais:visualizar')
  async consultarRtcSimplesNacionalRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('competencia') competencia: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoRtcSimplesNacional> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.consultarRtcSimplesNacional.executar(empresaId, competencia);
  }

  @Put('receita-mensal')
  @ExigirPermissao('notas_fiscais:editar')
  async definirReceitaMensalRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: DefinirReceitaMensalDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ReceitaMensal> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.definirReceitaMensal.executar({
      empresaId,
      competencia: dto.competencia,
      tipoAtividade: dto.tipoAtividade,
      valor: dto.valor,
      criadoPor: usuarioAtual.id,
      issRetidoNaFonte: dto.issRetidoNaFonte,
      issDevidoAOutroMunicipio: dto.issDevidoAOutroMunicipio,
    });
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
