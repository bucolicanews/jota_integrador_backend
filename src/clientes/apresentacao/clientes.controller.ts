import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AlternarAtivoClienteUseCase } from '../aplicacao/casos-de-uso/alternar-ativo-cliente.usecase';
import { AtualizarClienteUseCase } from '../aplicacao/casos-de-uso/atualizar-cliente.usecase';
import { CriarClienteUseCase } from '../aplicacao/casos-de-uso/criar-cliente.usecase';
import { ListarClientesUseCase } from '../aplicacao/casos-de-uso/listar-clientes.usecase';
import { Cliente } from '../aplicacao/portas/clientes-repositorio.port';
import { AtualizarClienteDto } from './dto/atualizar-cliente.dto';
import { CriarClienteDto } from './dto/criar-cliente.dto';

@Controller('empresas/:empresaId/clientes')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class ClientesController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarCliente: CriarClienteUseCase,
    private readonly listarClientes: ListarClientesUseCase,
    private readonly atualizarCliente: AtualizarClienteUseCase,
    private readonly alternarAtivo: AlternarAtivoClienteUseCase,
  ) {}

  @Get()
  @ExigirPermissao('clientes:visualizar')
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('apenasAtivos') apenasAtivos: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Cliente[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarClientes.executar(empresaId, apenasAtivos === 'true');
  }

  @Post()
  @ExigirPermissao('clientes:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarClienteDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Cliente> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarCliente.executar({ empresaId, ...dto });
  }

  @Patch(':id')
  @ExigirPermissao('clientes:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarClienteDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarCliente.executar(id, empresaId, dto);
    return { ok: true };
  }

  @Patch(':id/desativar')
  @ExigirPermissao('clientes:excluir')
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
  @ExigirPermissao('clientes:editar')
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
