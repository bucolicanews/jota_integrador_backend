import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { BuscarConfiguracaoLancamentosEsocialUseCase } from '../aplicacao/casos-de-uso/buscar-configuracao-lancamentos-esocial.usecase';
import { ImportarRemuneracaoEsocialUseCase, ResultadoImportacaoRemuneracao } from '../aplicacao/casos-de-uso/importar-remuneracao-esocial.usecase';
import { SalvarConfiguracaoLancamentosEsocialUseCase } from '../aplicacao/casos-de-uso/salvar-configuracao-lancamentos-esocial.usecase';
import { ConfiguracaoLancamentosEsocial } from '../aplicacao/portas/esocial-repositorio.port';
import { ImportarRemuneracaoEsocialDto } from './dto/importar-remuneracao-esocial.dto';
import { SalvarConfiguracaoLancamentosEsocialDto } from './dto/salvar-configuracao-lancamentos-esocial.dto';

@Controller('empresas/:empresaId/esocial')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class EsocialController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly buscarConfiguracaoLancamentos: BuscarConfiguracaoLancamentosEsocialUseCase,
    private readonly salvarConfiguracaoLancamentos: SalvarConfiguracaoLancamentosEsocialUseCase,
    private readonly importarRemuneracao: ImportarRemuneracaoEsocialUseCase,
  ) {}

  @Get('configuracao-lancamentos')
  @ExigirPermissao('esocial:visualizar')
  async obterConfiguracaoLancamentosRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ConfiguracaoLancamentosEsocial | null> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.buscarConfiguracaoLancamentos.executar(empresaId);
  }

  @Put('configuracao-lancamentos')
  @ExigirPermissao('esocial:editar')
  async salvarConfiguracaoLancamentosRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: SalvarConfiguracaoLancamentosEsocialDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    await this.salvarConfiguracaoLancamentos.executar({
      empresaId,
      contaDespesaSalarioId: dto.contaDespesaSalarioId,
      contaDespesaProLaboreId: dto.contaDespesaProLaboreId,
      contaDespesaInssId: dto.contaDespesaInssId,
      contaPassivoInssId: dto.contaPassivoInssId,
      contaPassivoSalarioAPagarId: dto.contaPassivoSalarioAPagarId,
      contaPassivoProLaboreAPagarId: dto.contaPassivoProLaboreAPagarId,
      contaDespesaFgtsId: dto.contaDespesaFgtsId ?? null,
      contaPassivoFgtsId: dto.contaPassivoFgtsId ?? null,
      atualizadoPor: usuarioAtual.id,
    });
    return { ok: true };
  }

  /** `confirmar=false` no body só calcula e devolve o preview; `confirmar=true` cria o lançamento contábil de verdade. */
  @Post('importar-remuneracao')
  @ExigirPermissao('esocial:editar')
  async importarRemuneracaoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: ImportarRemuneracaoEsocialDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoImportacaoRemuneracao> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.importarRemuneracao.executar({
      empresaId,
      arquivos: dto.arquivos,
      confirmar: dto.confirmar,
      usuarioAtualId: usuarioAtual.id,
    });
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
