import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { PagbankConfigService } from '../../common/pagbank/pagbank-config.service';
import { CONTADORES_REPOSITORIO, ContadoresRepositorioPort } from '../aplicacao/portas/contadores-repositorio.port';
import { AtualizarPagbankContaDto } from './dto/atualizar-pagbank-conta.dto';

/**
 * Cadastro 100% manual da conta PagBank do contador (sem OAuth/onboarding hospedado --
 * mesmo padrão simples já usado no projeto irmão). Contador cola o próprio account id,
 * obtido no painel da PagBank dele.
 */
@Controller('contadores/:contadorId/pagbank-conta')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PagbankContaController {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    private readonly pagbankConfig: PagbankConfigService,
  ) {}

  @Patch()
  async atualizar(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @Body() dto: AtualizarPagbankContaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    this.exigirPosse(usuarioAtual, contadorId);
    await this.contadoresRepositorio.atualizarPagbankAccountId(contadorId, dto.pagbankAccountId.trim());
    return { ok: true };
  }

  /** Frontend usa isso pra decidir se mostra a opção de venda com split (gating real é no backend). */
  @Get('status')
  async status(
    @Param('contadorId', ParseUUIDPipe) contadorId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ temContaCadastrada: boolean; splitHabilitado: boolean }> {
    this.exigirPosse(usuarioAtual, contadorId);

    const contador = await this.contadoresRepositorio.buscarPorId(contadorId);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }
    const { splitHabilitado } = await this.pagbankConfig.obterConfiguracaoSplit();
    return { temContaCadastrada: Boolean(contador.pagbankAccountId), splitHabilitado };
  }

  private exigirPosse(usuarioAtual: UsuarioAutenticado, contadorId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    if (usuarioAtual.contadorId !== contadorId) {
      throw new ForbiddenException('Sem autoridade sobre a conta PagBank deste contador');
    }
  }
}
