import { Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { EMPRESAS_REPOSITORIO, Empresa, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { ListarPendenciasPagamentoAtivacaoUseCase } from '../aplicacao/casos-de-uso/listar-pendencias-pagamento-ativacao.usecase';
import { PagamentoAtivacaoLicenca } from '../aplicacao/portas/pagamentos-ativacao-licenca-repositorio.port';

/** Tela "Pendências de ativação de módulo" na área da empresa-cliente (JOTA FISCAL). */
@Controller('empresas/:empresaId/pagamentos-ativacao-licenca')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PendenciasPagamentoController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly listarPendencias: ListarPendenciasPagamentoAtivacaoUseCase,
  ) {}

  @Get()
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PagamentoAtivacaoLicenca[]> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarPendencias.executar(empresaId);
  }

  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
