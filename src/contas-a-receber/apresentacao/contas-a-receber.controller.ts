import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { CancelarContaReceberUseCase } from '../aplicacao/casos-de-uso/cancelar-conta-receber.usecase';
import { CriarContaReceberUseCase } from '../aplicacao/casos-de-uso/criar-conta-receber.usecase';
import { EstornarRecebimentoUseCase } from '../aplicacao/casos-de-uso/estornar-recebimento.usecase';
import { ListarContasReceberUseCase } from '../aplicacao/casos-de-uso/listar-contas-receber.usecase';
import { ListarRecebimentosParcelaUseCase } from '../aplicacao/casos-de-uso/listar-recebimentos-parcela.usecase';
import { ObterContaReceberUseCase } from '../aplicacao/casos-de-uso/obter-conta-receber.usecase';
import { RegistrarRecebimentoUseCase } from '../aplicacao/casos-de-uso/registrar-recebimento.usecase';
import { ContaReceber, RecebimentoContaReceber } from '../aplicacao/portas/contas-receber-repositorio.port';
import { CriarContaReceberDto } from './dto/criar-conta-receber.dto';
import { EstornarRecebimentoDto } from './dto/estornar-recebimento.dto';
import { RegistrarRecebimentoDto } from './dto/registrar-recebimento.dto';

@Controller('empresas/:empresaId/contas-a-receber')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class ContasAReceberController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarContaReceber: CriarContaReceberUseCase,
    private readonly listarContasReceber: ListarContasReceberUseCase,
    private readonly obterContaReceber: ObterContaReceberUseCase,
    private readonly cancelarContaReceber: CancelarContaReceberUseCase,
    private readonly registrarRecebimento: RegistrarRecebimentoUseCase,
    private readonly estornarRecebimento: EstornarRecebimentoUseCase,
    private readonly listarRecebimentosParcela: ListarRecebimentosParcelaUseCase,
  ) {}

  @Get()
  @ExigirPermissao('contas_a_receber:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('status') status: ContaReceber['status'] | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ContaReceber[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarContasReceber.executar(empresaId, status ? { status } : undefined);
  }

  @Get(':id')
  @ExigirPermissao('contas_a_receber:visualizar')
  async obter(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ContaReceber> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterContaReceber.executar(id, empresaId);
  }

  @Post()
  @ExigirPermissao('contas_a_receber:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarContaReceberDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ id: string }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    const id = await this.criarContaReceber.executar({
      empresaId,
      clienteId: dto.clienteId ?? null,
      clienteNome: dto.clienteNome,
      descricao: dto.descricao,
      contaPatrimonialId: dto.contaPatrimonialId,
      contaResultadoId: dto.contaResultadoId,
      dataEmissao: dto.dataEmissao,
      criadoPor: usuarioAtual.id,
      modo: dto.modo,
      valor: dto.valor,
      quantidadeParcelas: dto.quantidadeParcelas ?? 1,
      primeiroVencimento: dto.primeiroVencimento,
      intervaloDias: dto.intervaloDias ?? 30,
    });
    return { id };
  }

  @Post(':id/cancelar')
  @ExigirPermissao('contas_a_receber:excluir')
  async cancelar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.cancelarContaReceber.executar(id, empresaId, usuarioAtual.id);
    return { ok: true };
  }

  @Post('parcelas/:parcelaId/recebimentos')
  @ExigirPermissao('contas_a_receber:criar')
  async registrarRecebimentoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('parcelaId', ParseUUIDPipe) parcelaId: string,
    @Body() dto: RegistrarRecebimentoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<RecebimentoContaReceber> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.registrarRecebimento.executar({
      parcelaId,
      empresaId,
      contaBancariaId: dto.contaBancariaId,
      valorRecebido: dto.valorRecebido,
      dataRecebimento: dto.dataRecebimento,
      usuarioId: usuarioAtual.id,
    });
  }

  @Get('parcelas/:parcelaId/recebimentos')
  @ExigirPermissao('contas_a_receber:visualizar')
  async listarRecebimentosDaParcelaRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('parcelaId', ParseUUIDPipe) parcelaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<RecebimentoContaReceber[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarRecebimentosParcela.executar(parcelaId, empresaId);
  }

  @Post('recebimentos/:recebimentoId/estornar')
  @ExigirPermissao('contas_a_receber:editar')
  async estornarRecebimentoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('recebimentoId', ParseUUIDPipe) recebimentoId: string,
    @Body() dto: EstornarRecebimentoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.estornarRecebimento.executar(recebimentoId, empresaId, dto.motivo, usuarioAtual.id);
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
