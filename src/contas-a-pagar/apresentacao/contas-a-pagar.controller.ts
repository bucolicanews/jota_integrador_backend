import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { CancelarContaPagarUseCase } from '../aplicacao/casos-de-uso/cancelar-conta-pagar.usecase';
import { CriarContaPagarUseCase } from '../aplicacao/casos-de-uso/criar-conta-pagar.usecase';
import { EstornarPagamentoUseCase } from '../aplicacao/casos-de-uso/estornar-pagamento.usecase';
import { ListarContasPagarUseCase } from '../aplicacao/casos-de-uso/listar-contas-pagar.usecase';
import { ListarPagamentosParcelaUseCase } from '../aplicacao/casos-de-uso/listar-pagamentos-parcela.usecase';
import { ObterContaPagarUseCase } from '../aplicacao/casos-de-uso/obter-conta-pagar.usecase';
import { RegistrarPagamentoUseCase } from '../aplicacao/casos-de-uso/registrar-pagamento.usecase';
import { ContaPagar, PagamentoContaPagar } from '../aplicacao/portas/contas-pagar-repositorio.port';
import { CriarContaPagarDto } from './dto/criar-conta-pagar.dto';
import { EstornarPagamentoDto } from './dto/estornar-pagamento.dto';
import { RegistrarPagamentoDto } from './dto/registrar-pagamento.dto';

@Controller('empresas/:empresaId/contas-a-pagar')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class ContasAPagarController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarContaPagar: CriarContaPagarUseCase,
    private readonly listarContasPagar: ListarContasPagarUseCase,
    private readonly obterContaPagar: ObterContaPagarUseCase,
    private readonly cancelarContaPagar: CancelarContaPagarUseCase,
    private readonly registrarPagamento: RegistrarPagamentoUseCase,
    private readonly estornarPagamento: EstornarPagamentoUseCase,
    private readonly listarPagamentosParcela: ListarPagamentosParcelaUseCase,
  ) {}

  @Get()
  @ExigirPermissao('contas_a_pagar:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('status') status: ContaPagar['status'] | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ContaPagar[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarContasPagar.executar(empresaId, status ? { status } : undefined);
  }

  @Get(':id')
  @ExigirPermissao('contas_a_pagar:visualizar')
  async obter(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ContaPagar> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterContaPagar.executar(id, empresaId);
  }

  @Post()
  @ExigirPermissao('contas_a_pagar:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarContaPagarDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ id: string }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    const id = await this.criarContaPagar.executar({
      empresaId,
      fornecedorId: dto.fornecedorId ?? null,
      fornecedor: dto.fornecedor,
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
  @ExigirPermissao('contas_a_pagar:excluir')
  async cancelar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.cancelarContaPagar.executar(id, empresaId, usuarioAtual.id);
    return { ok: true };
  }

  @Post('parcelas/:parcelaId/pagamentos')
  @ExigirPermissao('contas_a_pagar:criar')
  async registrarPagamentoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('parcelaId', ParseUUIDPipe) parcelaId: string,
    @Body() dto: RegistrarPagamentoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PagamentoContaPagar> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.registrarPagamento.executar({
      parcelaId,
      empresaId,
      contaBancariaId: dto.contaBancariaId,
      valorPago: dto.valorPago,
      dataPagamento: dto.dataPagamento,
      usuarioId: usuarioAtual.id,
    });
  }

  @Get('parcelas/:parcelaId/pagamentos')
  @ExigirPermissao('contas_a_pagar:visualizar')
  async listarPagamentosDaParcelaRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('parcelaId', ParseUUIDPipe) parcelaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PagamentoContaPagar[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarPagamentosParcela.executar(parcelaId, empresaId);
  }

  @Post('pagamentos/:pagamentoId/estornar')
  @ExigirPermissao('contas_a_pagar:editar')
  async estornarPagamentoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('pagamentoId', ParseUUIDPipe) pagamentoId: string,
    @Body() dto: EstornarPagamentoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.estornarPagamento.executar(pagamentoId, empresaId, dto.motivo, usuarioAtual.id);
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
