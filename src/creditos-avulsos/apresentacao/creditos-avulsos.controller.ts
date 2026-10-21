import { Body, Controller, ForbiddenException, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  IniciarCompraCreditoAvulsoUseCase,
  ResultadoIniciarCompraCreditoAvulso,
} from '../aplicacao/casos-de-uso/iniciar-compra-credito-avulso.usecase';
import { IniciarCompraCreditoAvulsoDto } from './dto/iniciar-compra-credito-avulso.dto';

/**
 * Compra de crédito avulso -- diferente de CreditosController (ajuste manual, só
 * plataforma/contador), aqui a PRÓPRIA empresa pode comprar pra si mesma (mesma posse de
 * leitura de saldo/movimentos), além do contador da carteira iniciar em nome dela.
 */
@Controller('empresas/:empresaId/creditos-avulsos')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class CreditosAvulsosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly iniciarCompra: IniciarCompraCreditoAvulsoUseCase,
  ) {}

  @Post('comprar')
  async comprar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: IniciarCompraCreditoAvulsoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoIniciarCompraCreditoAvulso> {
    await this.exigirPosse(usuarioAtual, empresaId);
    return this.iniciarCompra.executar({
      empresaId,
      pacoteId: dto.pacoteId,
      customerEmail: dto.customerEmail,
      customerTelefoneE164: dto.customerTelefoneE164 ?? null,
    });
  }

  /** Plataforma, contador dono da carteira, ou a própria empresa comprando pra si mesma. */
  private async exigirPosse(usuarioAtual: UsuarioAutenticado, empresaId: string): Promise<void> {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    if (usuarioAtual.empresaId === empresaId) return;

    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    if (usuarioAtual.contadorId !== empresa.contadorId) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
