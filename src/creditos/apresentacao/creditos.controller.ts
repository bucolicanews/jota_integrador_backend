import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma, Papel } from '../../auth/dominio/papel';
import { CreditarCreditosUseCase } from '../aplicacao/casos-de-uso/creditar-creditos.usecase';
import { DebitarCreditosManualUseCase } from '../aplicacao/casos-de-uso/debitar-creditos-manual.usecase';
import { ListarMovimentosUseCase } from '../aplicacao/casos-de-uso/listar-movimentos.usecase';
import { ObterSaldoUseCase } from '../aplicacao/casos-de-uso/obter-saldo.usecase';
import { MovimentoCredito } from '../aplicacao/portas/creditos-repositorio.port';
import { AjustarCreditosDto } from './dto/ajustar-creditos.dto';

/**
 * Créditos SERPRO são por EMPRESA-CLIENTE (não mais por contador) -- cada empresa tem o
 * próprio saldo/plano. Leitura (saldo/extrato) é liberada pra plataforma, contador dono
 * e a própria empresa. Ajuste manual avulso (creditar/debitar fora de pagamento ou
 * cota do plano) é EXCLUSIVO da plataforma (SUPER_ADMIN/ADMIN_FINANCEIRO) -- revertido
 * em 2026-10-21 a decisão anterior (2026-10-14) que também deixava o contador fazer
 * esse ajuste direto; contador e empresa nunca inserem/retiram crédito de forma avulsa.
 */
@Controller('empresas/:empresaId/creditos')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class CreditosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly obterSaldo: ObterSaldoUseCase,
    private readonly listarMovimentos: ListarMovimentosUseCase,
    private readonly creditarCreditos: CreditarCreditosUseCase,
    private readonly debitarCreditosManual: DebitarCreditosManualUseCase,
  ) {}

  @Get('saldo')
  async saldo(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ saldo: number }> {
    await this.exigirPosse(usuarioAtual, empresaId);
    return { saldo: await this.obterSaldo.executar(empresaId) };
  }

  @Get('movimentos')
  async movimentos(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<MovimentoCredito[]> {
    await this.exigirPosse(usuarioAtual, empresaId);
    return this.listarMovimentos.executar(empresaId);
  }

  @Post('creditar')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async creditar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: AjustarCreditosDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ saldo: number }> {
    const contadorId = await this.exigirPosseDeGestao(usuarioAtual, empresaId);
    return { saldo: await this.creditarCreditos.executar(contadorId, empresaId, dto.quantidade, dto.motivo) };
  }

  @Post('debitar')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
  async debitar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: AjustarCreditosDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ saldo: number }> {
    const contadorId = await this.exigirPosseDeGestao(usuarioAtual, empresaId);
    return { saldo: await this.debitarCreditosManual.executar(contadorId, empresaId, dto.quantidade, dto.motivo) };
  }

  /** Leitura: plataforma, contador dono da carteira, ou a própria empresa vendo o próprio saldo. */
  private async exigirPosse(usuarioAtual: UsuarioAutenticado, empresaId: string): Promise<void> {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    if (usuarioAtual.empresaId === empresaId) return;
    await this.exigirPosseDeGestao(usuarioAtual, empresaId);
  }

  /** Escrita (creditar/debitar): só plataforma ou o contador dono da empresa -- créditos são dado financeiro, a própria empresa nunca ajusta o próprio saldo. Retorna o contadorId real da empresa, pra gravar auditoria certa mesmo quando quem chama é plataforma. */
  private async exigirPosseDeGestao(usuarioAtual: UsuarioAutenticado, empresaId: string): Promise<string> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    if (ehPapelDePlataforma(usuarioAtual.papel)) return empresa.contadorId;
    if (usuarioAtual.contadorId !== empresa.contadorId) {
      throw new ForbiddenException('Sem autoridade sobre os créditos desta empresa');
    }
    return empresa.contadorId;
  }
}
