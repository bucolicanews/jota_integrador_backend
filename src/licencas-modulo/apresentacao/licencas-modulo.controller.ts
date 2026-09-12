import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { AtivarLicencaUseCase } from '../aplicacao/casos-de-uso/ativar-licenca.usecase';
import { DesativarLicencaUseCase } from '../aplicacao/casos-de-uso/desativar-licenca.usecase';
import { IniciarCheckoutLicencaUseCase } from '../aplicacao/casos-de-uso/iniciar-checkout-licenca.usecase';
import { ListarLicencasUseCase } from '../aplicacao/casos-de-uso/listar-licencas.usecase';
import { LicencaModulo } from '../aplicacao/portas/licencas-modulo-repositorio.port';
import { AtivarLicencaDto } from './dto/ativar-licenca.dto';
import { IniciarCheckoutLicencaDto } from './dto/iniciar-checkout-licenca.dto';

@Controller('contadores/:contadorId/licencas-modulo')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class LicencasModuloController {
  constructor(
    private readonly listarLicencas: ListarLicencasUseCase,
    private readonly iniciarCheckout: IniciarCheckoutLicencaUseCase,
    private readonly ativarLicenca: AtivarLicencaUseCase,
    private readonly desativarLicenca: DesativarLicencaUseCase,
  ) {}

  @Get()
  async listar(@Param('contadorId', ParseUUIDPipe) contadorId: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<LicencaModulo[]> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.listarLicencas.executar(contadorId);
  }

  @Post('checkout')
  async checkout(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Body() dto: IniciarCheckoutLicencaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ url: string }> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.iniciarCheckout.executar({ contadorId, pacoteId: dto.pacoteId, successUrl: dto.successUrl, cancelUrl: dto.cancelUrl });
  }

  @Post(':licencaId/ativar')
  async ativar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('licencaId', ParseUUIDPipe) licencaId: string,
    @Body() dto: AtivarLicencaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<LicencaModulo> {
    this.exigirPosse(usuarioAtual, contadorId);
    return this.ativarLicenca.executar({
      licencaId,
      contadorId,
      empresaId: dto.empresaId,
      valorCobrado: dto.valorCobrado ?? null,
      parcelamento: dto.parcelamento ?? null,
      executadoPor: usuarioAtual.id,
    });
  }

  @Post(':licencaId/desativar')
  async desativar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Param('licencaId', ParseUUIDPipe) licencaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    this.exigirPosse(usuarioAtual, contadorId);
    await this.desativarLicenca.executar(licencaId, contadorId);
    return { ok: true };
  }

  private exigirPosse(usuarioAtual: UsuarioAutenticado, contadorId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    if (usuarioAtual.contadorId !== contadorId) {
      throw new ForbiddenException('Sem autoridade sobre as licenças deste contador');
    }
  }
}
