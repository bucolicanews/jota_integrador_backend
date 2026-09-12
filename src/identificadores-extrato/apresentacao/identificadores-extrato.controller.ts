import { Body, Controller, Delete, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { ExigirModulo } from '../../common/modulos/exigir-modulo.decorator';
import { ModulosGuard } from '../../common/modulos/modulos.guard';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AtualizarIdentificadorExtratoUseCase } from '../aplicacao/casos-de-uso/atualizar-identificador-extrato.usecase';
import { CriarIdentificadorExtratoUseCase } from '../aplicacao/casos-de-uso/criar-identificador-extrato.usecase';
import { ExcluirIdentificadorExtratoUseCase } from '../aplicacao/casos-de-uso/excluir-identificador-extrato.usecase';
import { ListarIdentificadoresExtratoUseCase } from '../aplicacao/casos-de-uso/listar-identificadores-extrato.usecase';
import { IdentificadorExtrato } from '../aplicacao/portas/identificadores-extrato-repositorio.port';
import { AtualizarIdentificadorExtratoDto } from './dto/atualizar-identificador-extrato.dto';
import { CriarIdentificadorExtratoDto } from './dto/criar-identificador-extrato.dto';

@Controller('empresas/:empresaId/identificadores-extrato')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard, ModulosGuard)
@ExigirModulo('conciliacao_bancaria')
export class IdentificadoresExtratoController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarIdentificador: CriarIdentificadorExtratoUseCase,
    private readonly listarIdentificadores: ListarIdentificadoresExtratoUseCase,
    private readonly atualizarIdentificador: AtualizarIdentificadorExtratoUseCase,
    private readonly excluirIdentificador: ExcluirIdentificadorExtratoUseCase,
  ) {}

  @Get()
  @ExigirPermissao('identificadores_extrato:visualizar')
  async listar(@Param('empresaId', ParseUUIDPipe) empresaId: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<IdentificadorExtrato[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarIdentificadores.executar(empresaId);
  }

  @Post()
  @ExigirPermissao('identificadores_extrato:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarIdentificadorExtratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<IdentificadorExtrato> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarIdentificador.executar({ empresaId, ...dto });
  }

  @Patch(':id')
  @ExigirPermissao('identificadores_extrato:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarIdentificadorExtratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarIdentificador.executar(id, empresaId, dto);
    return { ok: true };
  }

  @Delete(':id')
  @ExigirPermissao('identificadores_extrato:excluir')
  async excluir(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirIdentificador.executar(id, empresaId);
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
