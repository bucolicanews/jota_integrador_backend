import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { GerenciarComissaoPlataformaUseCase } from '../aplicacao/casos-de-uso/gerenciar-comissao-plataforma.usecase';
import { GerenciarConfiguracaoPagbankUseCase } from '../aplicacao/casos-de-uso/gerenciar-configuracao-pagbank.usecase';
import { ConfiguracaoPagbank } from '../aplicacao/portas/configuracao-plataforma-repositorio.port';
import { AtualizarComissaoDto } from './dto/atualizar-comissao.dto';
import { AtualizarComissaoContratosDto } from './dto/atualizar-comissao-contratos.dto';
import { AtualizarConfiguracaoPagbankDto } from './dto/atualizar-configuracao-pagbank.dto';

@Controller('configuracoes-plataforma')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
@Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
export class ConfiguracaoPlataformaController {
  constructor(
    private readonly comissao: GerenciarComissaoPlataformaUseCase,
    private readonly pagbank: GerenciarConfiguracaoPagbankUseCase,
  ) {}

  @Get('comissao-honorarios')
  @ExigirPermissao('configuracoes:visualizar')
  async obterComissao(): Promise<{ comissaoHonorariosPct: number }> {
    return { comissaoHonorariosPct: await this.comissao.obter() };
  }

  @Patch('comissao-honorarios')
  async atualizarComissao(
    @Body() dto: AtualizarComissaoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.comissao.atualizar(dto.comissaoHonorariosPct, usuarioAtual.id);
    return { ok: true };
  }

  @Get('comissao-contratos')
  @ExigirPermissao('configuracoes:visualizar')
  async obterComissaoContratos(): Promise<{ comissaoContratosPct: number }> {
    return { comissaoContratosPct: await this.comissao.obterContratos() };
  }

  @Patch('comissao-contratos')
  async atualizarComissaoContratos(
    @Body() dto: AtualizarComissaoContratosDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.comissao.atualizarContratos(dto.comissaoContratosPct, usuarioAtual.id);
    return { ok: true };
  }

  @Get('pagbank')
  @ExigirPermissao('configuracoes:visualizar')
  async obterPagbank(): Promise<ConfiguracaoPagbank> {
    return this.pagbank.obter();
  }

  @Patch('pagbank')
  async atualizarPagbank(
    @Body() dto: AtualizarConfiguracaoPagbankDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.pagbank.atualizar(dto, usuarioAtual.id);
    return { ok: true };
  }
}
