import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { PagbankConfigService } from '../../common/pagbank/pagbank-config.service';
import { AtualizarPagbankContaEmpresaUseCase } from '../aplicacao/casos-de-uso/atualizar-pagbank-conta-empresa.usecase';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../aplicacao/portas/empresas-repositorio.port';
import { AtualizarPagbankContaEmpresaDto } from './dto/atualizar-pagbank-conta-empresa.dto';

/**
 * Cadastro 100% manual da conta PagBank PRÓPRIA de uma empresa (contador, empresa-cliente
 * ou a interna_plataforma do admin) -- mesmo padrão simples de PATCH /contadores/:id/pagbank-conta,
 * agora pra quem vai receber split de um link de pagamento de parcela (contas a receber).
 */
@Controller('empresas/:empresaId/pagbank-conta')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PagbankContaEmpresaController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly atualizarPagbankConta: AtualizarPagbankContaEmpresaUseCase,
    private readonly pagbankConfig: PagbankConfigService,
  ) {}

  @Patch()
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: AtualizarPagbankContaEmpresaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    await this.atualizarPagbankConta.executar(empresaId, {
      pagbankAccountId: dto.pagbankAccountId === undefined ? undefined : (dto.pagbankAccountId?.trim() ?? null),
      bancoPagbankId: dto.bancoPagbankId,
      contaContabilPagbankId: dto.contaContabilPagbankId,
    });
    return { ok: true };
  }

  /** Frontend usa isso pra decidir se mostra a opção de gerar link de pagamento com split (gating real é no backend). */
  @Get('status')
  async status(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ temContaCadastrada: boolean; temBancoPadrao: boolean; splitHabilitado: boolean }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    const { splitHabilitado } = await this.pagbankConfig.obterConfiguracaoSplit();
    return {
      temContaCadastrada: Boolean(empresa.pagbankAccountId),
      temBancoPadrao: Boolean(empresa.bancoPagbankId || empresa.contaContabilPagbankId),
      splitHabilitado,
    };
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre a conta PagBank desta empresa');
    }
  }
}
