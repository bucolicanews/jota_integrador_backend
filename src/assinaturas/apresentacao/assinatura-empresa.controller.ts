import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { IniciarPagamentoAssinaturaCreditosUseCase, ResultadoIniciarPagamentoAssinaturaCreditos } from '../aplicacao/casos-de-uso/iniciar-pagamento-assinatura-creditos.usecase';
import { ListarPlanosRevendaDisponiveisUseCase, PlanoRevendaDisponivelAssinatura } from '../aplicacao/casos-de-uso/listar-planos-revenda-disponiveis.usecase';
import { ObterAssinaturaAtualUseCase } from '../aplicacao/casos-de-uso/obter-assinatura-atual.usecase';
import { Assinatura } from '../aplicacao/portas/assinaturas-repositorio.port';
import { IniciarPagamentoAssinaturaDto } from './dto/iniciar-pagamento-assinatura.dto';

/**
 * Lado JOTA FISCAL: a própria empresa vê o catálogo de revenda do SEU contador e assinta
 * sozinha (self-service), sem esperar ele iniciar a cobrança -- mesmo mecanismo de
 * AssinaturasController, só que resolvendo contadorId internamente (a empresa não precisa
 * saber o id do próprio contador) e restrito a ela mesma (nunca outro contador em nome
 * dela, mesmo cuidado de CreditosAvulsosController/comprar via planoRevendaId).
 */
@Controller('empresas/:empresaId/assinatura')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class AssinaturaEmpresaController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly obterAssinaturaAtual: ObterAssinaturaAtualUseCase,
    private readonly listarPlanosRevenda: ListarPlanosRevendaDisponiveisUseCase,
    private readonly iniciarPagamento: IniciarPagamentoAssinaturaCreditosUseCase,
  ) {}

  @Get()
  async atual(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Assinatura | null> {
    this.exigirPosse(usuarioAtual, empresaId);
    return this.obterAssinaturaAtual.executar(empresaId);
  }

  @Get('planos-revenda')
  async planosRevenda(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PlanoRevendaDisponivelAssinatura[]> {
    this.exigirPosse(usuarioAtual, empresaId);
    return this.listarPlanosRevenda.executar(empresaId);
  }

  @Post('iniciar-pagamento')
  async iniciarPagamentoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: IniciarPagamentoAssinaturaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoIniciarPagamentoAssinaturaCreditos> {
    this.exigirPosse(usuarioAtual, empresaId);
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return this.iniciarPagamento.executar({
      contadorId: empresa.contadorId,
      empresaId,
      planoId: dto.planoId,
      metodo: dto.metodo,
      customerEmail: dto.customerEmail,
      customerTelefoneE164: dto.customerTelefoneE164 ?? null,
    });
  }

  /** Só a própria empresa ou a plataforma -- nunca o contador (ele já tem AssinaturasController pra isso). */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresaId: string): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    if (usuarioAtual.empresaId === empresaId) return;
    throw new ForbiddenException('Sem autoridade sobre a assinatura desta empresa');
  }
}
