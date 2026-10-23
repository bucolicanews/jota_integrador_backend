import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { IniciarPagamentoAtivacaoLicencaUseCase, ResultadoIniciarPagamento } from '../aplicacao/casos-de-uso/iniciar-pagamento-ativacao-licenca.usecase';
import { ListarLicencasDisponiveisParaEmpresaUseCase, LicencaDisponivelParaEmpresa } from '../aplicacao/casos-de-uso/listar-licencas-disponiveis-para-empresa.usecase';
import { IniciarPagamentoAtivacaoDto } from './dto/iniciar-pagamento-ativacao.dto';

/**
 * Lado JOTA FISCAL: a própria empresa vê as licenças do SEU contador já compradas no
 * atacado e com plano de revenda ativo, e ativa sozinha pagando (self-service) -- sem
 * esperar o contador clicar "ativar numa empresa". Mesmo cuidado de
 * AssinaturaEmpresaController/CreditosAvulsosController: só ela mesma, nunca outro
 * contador agindo em nome dela.
 */
@Controller('empresas/:empresaId/licencas-modulo')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class LicencasModuloEmpresaController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly listarDisponiveis: ListarLicencasDisponiveisParaEmpresaUseCase,
    private readonly iniciarPagamentoAtivacao: IniciarPagamentoAtivacaoLicencaUseCase,
  ) {}

  @Get('disponiveis')
  async disponiveis(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<LicencaDisponivelParaEmpresa[]> {
    this.exigirPosse(usuarioAtual, empresaId);
    return this.listarDisponiveis.executar(empresaId);
  }

  @Post(':licencaId/iniciar-pagamento')
  async iniciarPagamento(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('licencaId', ParseUUIDPipe) licencaId: string,
    @Body() dto: IniciarPagamentoAtivacaoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoIniciarPagamento> {
    this.exigirPosse(usuarioAtual, empresaId);
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return this.iniciarPagamentoAtivacao.executar({
      licencaId,
      contadorId: empresa.contadorId,
      empresaId,
      metodo: dto.metodo,
      customerEmail: dto.customerEmail,
      customerTelefoneE164: dto.customerTelefoneE164 ?? null,
    });
  }

  /** Só a própria empresa ou a plataforma -- o contador já tem LicencasModuloController pra isso. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresaId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    if (usuarioAtual.empresaId === empresaId) return;
    throw new ForbiddenException('Sem autoridade sobre as licenças desta empresa');
  }
}
