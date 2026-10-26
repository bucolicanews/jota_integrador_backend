import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { AtivarAssinaturaManualUseCase } from '../aplicacao/casos-de-uso/ativar-assinatura-manual.usecase';
import { AtualizarVencimentoAssinaturaUseCase } from '../aplicacao/casos-de-uso/atualizar-vencimento-assinatura.usecase';
import { BloquearAssinaturaUseCase } from '../aplicacao/casos-de-uso/bloquear-assinatura.usecase';
import { CancelarAssinaturaCreditoUseCase } from '../aplicacao/casos-de-uso/cancelar-assinatura-credito.usecase';
import { IniciarPagamentoAssinaturaCreditosUseCase, ResultadoIniciarPagamentoAssinaturaCreditos } from '../aplicacao/casos-de-uso/iniciar-pagamento-assinatura-creditos.usecase';
import { ObterAssinaturaAtualUseCase } from '../aplicacao/casos-de-uso/obter-assinatura-atual.usecase';
import { Assinatura } from '../aplicacao/portas/assinaturas-repositorio.port';
import { AtivarAssinaturaManualDto } from './dto/ativar-assinatura-manual.dto';
import { AtualizarVencimentoAssinaturaDto } from './dto/atualizar-vencimento-assinatura.dto';
import { IniciarPagamentoAssinaturaDto } from './dto/iniciar-pagamento-assinatura.dto';

/**
 * Assinatura de créditos SERPRO por EMPRESA-CLIENTE (não mais por contador, mudança de
 * 2026-10-14 -- ver [[project_jota_integrador]]). Contador gerencia diretamente: ativa
 * manualmente sem cobrar, cobra via PIX com split PagBank, ou bloqueia.
 */
@Controller('contadores/:contadorId/empresas/:empresaId/assinatura')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class AssinaturasController {
  constructor(
    private readonly obterAssinaturaAtual: ObterAssinaturaAtualUseCase,
    private readonly ativarManual: AtivarAssinaturaManualUseCase,
    private readonly bloquear: BloquearAssinaturaUseCase,
    private readonly cancelar: CancelarAssinaturaCreditoUseCase,
    private readonly iniciarPagamento: IniciarPagamentoAssinaturaCreditosUseCase,
    private readonly atualizarVencimento: AtualizarVencimentoAssinaturaUseCase,
  ) {}

  @Get()
  async atual(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Assinatura | null> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.obterAssinaturaAtual.executar(empresaId);
  }

  @Post('ativar-manual')
  async ativarManualRota(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: AtivarAssinaturaManualDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Assinatura> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.ativarManual.executar({
      contadorId,
      empresaId,
      planoId: dto.planoId,
      planoRevendaId: dto.planoRevendaId ?? null,
    });
  }

  @Post('bloquear')
  async bloquearRota(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    this.exigirPosse(usuarioAtual, contadorId);
    await this.bloquear.executar(contadorId, empresaId);
    return { ok: true };
  }

  @Post('cancelar')
  async cancelarRota(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    this.exigirPosse(usuarioAtual, contadorId);
    await this.cancelar.executar(contadorId, empresaId);
    return { ok: true };
  }

  @Post('iniciar-pagamento')
  async iniciarPagamentoRota(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: IniciarPagamentoAssinaturaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoIniciarPagamentoAssinaturaCreditos> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.iniciarPagamento.executar({
      contadorId,
      empresaId,
      planoId: dto.planoId,
      metodo: dto.metodo,
      cardEncrypted: dto.cardEncrypted,
      installments: dto.installments,
      customerEmail: dto.customerEmail,
      customerTelefoneE164: dto.customerTelefoneE164 ?? null,
    });
  }

  @Patch('vencimento')
  async atualizarVencimentoRota(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: AtualizarVencimentoAssinaturaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Assinatura> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.atualizarVencimento.executar({
      usuarioId: usuarioAtual.id,
      contadorId,
      empresaId,
      fimEm: dto.fimEm ?? null,
    });
  }

  /** Plataforma ou o próprio contador -- assinatura/crédito é dado financeiro, mesma regra do CreditosController. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, contadorId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    if (usuarioAtual.contadorId !== contadorId) {
      throw new ForbiddenException('Sem autoridade sobre a assinatura desta empresa');
    }
  }
}
