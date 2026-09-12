import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AlternarAtivoFornecedorUseCase } from '../aplicacao/casos-de-uso/alternar-ativo-fornecedor.usecase';
import { AtualizarFornecedorUseCase } from '../aplicacao/casos-de-uso/atualizar-fornecedor.usecase';
import { CriarFornecedorUseCase } from '../aplicacao/casos-de-uso/criar-fornecedor.usecase';
import { ListarFornecedoresUseCase } from '../aplicacao/casos-de-uso/listar-fornecedores.usecase';
import { Fornecedor } from '../aplicacao/portas/fornecedores-repositorio.port';
import { AtualizarFornecedorDto } from './dto/atualizar-fornecedor.dto';
import { CriarFornecedorDto } from './dto/criar-fornecedor.dto';

@Controller('empresas/:empresaId/fornecedores')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class FornecedoresController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarFornecedor: CriarFornecedorUseCase,
    private readonly listarFornecedores: ListarFornecedoresUseCase,
    private readonly atualizarFornecedor: AtualizarFornecedorUseCase,
    private readonly alternarAtivo: AlternarAtivoFornecedorUseCase,
  ) {}

  @Get()
  @ExigirPermissao('fornecedores:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('apenasAtivos') apenasAtivos: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Fornecedor[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarFornecedores.executar(empresaId, apenasAtivos === 'true');
  }

  @Post()
  @ExigirPermissao('fornecedores:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarFornecedorDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Fornecedor> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarFornecedor.executar({ empresaId, ...dto });
  }

  @Patch(':id')
  @ExigirPermissao('fornecedores:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarFornecedorDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarFornecedor.executar(id, empresaId, dto);
    return { ok: true };
  }

  @Patch(':id/desativar')
  @ExigirPermissao('fornecedores:excluir')
  async desativar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.alternarAtivo.executar(id, empresaId, false);
    return { ok: true };
  }

  @Patch(':id/reativar')
  @ExigirPermissao('fornecedores:editar')
  async reativar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.alternarAtivo.executar(id, empresaId, true);
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
