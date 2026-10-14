import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { GerenciarComissaoPlataformaUseCase } from '../aplicacao/casos-de-uso/gerenciar-comissao-plataforma.usecase';
import { GerenciarConfiguracaoPagbankUseCase } from '../aplicacao/casos-de-uso/gerenciar-configuracao-pagbank.usecase';
import { ConfiguracaoPagbank } from '../aplicacao/portas/configuracao-plataforma-repositorio.port';
import { AtualizarComissaoDto } from './dto/atualizar-comissao.dto';
import { AtualizarConfiguracaoPagbankDto } from './dto/atualizar-configuracao-pagbank.dto';

@Controller('configuracoes-plataforma')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
@Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO)
export class ConfiguracaoPlataformaController {
  constructor(
    private readonly comissao: GerenciarComissaoPlataformaUseCase,
    private readonly pagbank: GerenciarConfiguracaoPagbankUseCase,
  ) {}

  @Get('comissao-honorarios')
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

  @Get('pagbank')
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
