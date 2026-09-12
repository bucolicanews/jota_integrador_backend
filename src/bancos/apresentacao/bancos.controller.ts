import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AlternarAtivoBancoUseCase } from '../aplicacao/casos-de-uso/alternar-ativo-banco.usecase';
import { AtualizarBancoUseCase } from '../aplicacao/casos-de-uso/atualizar-banco.usecase';
import { CriarBancoUseCase } from '../aplicacao/casos-de-uso/criar-banco.usecase';
import { BancoComSaldo, ListarBancosUseCase } from '../aplicacao/casos-de-uso/listar-bancos.usecase';
import { Banco } from '../aplicacao/portas/bancos-repositorio.port';
import { AtualizarBancoDto } from './dto/atualizar-banco.dto';
import { CriarBancoDto } from './dto/criar-banco.dto';

@Controller('empresas/:empresaId/bancos')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class BancosController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarBanco: CriarBancoUseCase,
    private readonly listarBancos: ListarBancosUseCase,
    private readonly atualizarBanco: AtualizarBancoUseCase,
    private readonly alternarAtivo: AlternarAtivoBancoUseCase,
  ) {}

  @Get()
  @ExigirPermissao('bancos:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('apenasAtivos') apenasAtivos: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<BancoComSaldo[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarBancos.executar(empresaId, apenasAtivos === 'true');
  }

  @Post()
  @ExigirPermissao('bancos:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarBancoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Banco> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarBanco.executar({ empresaId, nome: dto.nome, contaContabilId: dto.contaContabilId, usuarioId: usuarioAtual.id });
  }

  @Patch(':id')
  @ExigirPermissao('bancos:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarBancoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarBanco.executar(id, empresaId, dto, usuarioAtual.id);
    return { ok: true };
  }

  @Patch(':id/desativar')
  @ExigirPermissao('bancos:excluir')
  async desativar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.alternarAtivo.executar(id, empresaId, false, usuarioAtual.id);
    return { ok: true };
  }

  @Patch(':id/reativar')
  @ExigirPermissao('bancos:editar')
  async reativar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.alternarAtivo.executar(id, empresaId, true, usuarioAtual.id);
    return { ok: true };
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

  private exigirPosseDeContador(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;
    if (usuarioAtual.contadorId !== empresa.contadorId) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
