import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { ehPapelDePlataforma } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { GerarLinkPagamentoParcelaUseCase, ResultadoGerarLinkPagamento } from '../aplicacao/casos-de-uso/gerar-link-pagamento-parcela.usecase';
import { LINKS_PAGAMENTO_PARCELA_REPOSITORIO, LinkPagamentoParcela, LinksPagamentoParcelaRepositorioPort } from '../aplicacao/portas/links-pagamento-parcela-repositorio.port';
import { GerarLinkPagamentoDto } from './dto/gerar-link-pagamento.dto';

/**
 * Rota paralela a ContasAReceberController (mesmo prefixo) de propósito -- módulo
 * separado pra não acoplar o split PagBank à lógica pura de bookkeeping de contas a
 * receber (mesmo motivo de TestarConexaoSerproController ser separado de
 * EmpresasController).
 */
@Controller('empresas/:empresaId/contas-a-receber/parcelas/:parcelaId/link-pagamento')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class LinkPagamentoParcelaController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(LINKS_PAGAMENTO_PARCELA_REPOSITORIO)
    private readonly linksRepositorio: LinksPagamentoParcelaRepositorioPort,
    private readonly gerarLink: GerarLinkPagamentoParcelaUseCase,
  ) {}

  @Post()
  @ExigirPermissao('contas_a_receber:criar')
  async gerar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('parcelaId', ParseUUIDPipe) parcelaId: string,
    @Body() dto: GerarLinkPagamentoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoGerarLinkPagamento> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    return this.gerarLink.executar({
      empresaId,
      parcelaId,
      metodo: dto.metodo,
      cardEncrypted: dto.cardEncrypted,
      installments: dto.installments,
      criadoPor: usuarioAtual.id,
    });
  }

  @Get()
  @ExigirPermissao('contas_a_receber:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('parcelaId', ParseUUIDPipe) parcelaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<LinkPagamentoParcela[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.linksRepositorio.listarPorParcela(parcelaId);
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  // Deliberadamente a checagem AMPLA (contador dono OU a própria empresa) -- ao
  // contrário de exigirPosseDeContador em ContasAReceberController: a empresa-cliente
  // precisa poder gerar/ver o próprio link de pagamento, autossuficiência é o objetivo
  // desta feature (confirmado com o usuário).
  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (ehPapelDePlataforma(usuarioAtual.papel)) return;
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
