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
import { AtualizarDescricaoExtratoUseCase } from '../aplicacao/casos-de-uso/atualizar-descricao-extrato.usecase';
import { CriarDescricaoExtratoUseCase } from '../aplicacao/casos-de-uso/criar-descricao-extrato.usecase';
import { ExcluirDescricaoExtratoUseCase } from '../aplicacao/casos-de-uso/excluir-descricao-extrato.usecase';
import { ListarDescricoesExtratoUseCase } from '../aplicacao/casos-de-uso/listar-descricoes-extrato.usecase';
import { DescricaoExtrato } from '../aplicacao/portas/descricoes-extrato-repositorio.port';
import { AtualizarDescricaoExtratoDto } from './dto/atualizar-descricao-extrato.dto';
import { CriarDescricaoExtratoDto } from './dto/criar-descricao-extrato.dto';

@Controller('empresas/:empresaId/descricoes-extrato')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard, ModulosGuard)
@ExigirModulo('conciliacao_bancaria')
export class DescricoesExtratoController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarDescricao: CriarDescricaoExtratoUseCase,
    private readonly listarDescricoes: ListarDescricoesExtratoUseCase,
    private readonly atualizarDescricao: AtualizarDescricaoExtratoUseCase,
    private readonly excluirDescricao: ExcluirDescricaoExtratoUseCase,
  ) {}

  @Get()
  @ExigirPermissao('descricoes_extrato:visualizar')
  async listar(@Param('empresaId', ParseUUIDPipe) empresaId: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<DescricaoExtrato[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarDescricoes.executar(empresaId);
  }

  @Post()
  @ExigirPermissao('descricoes_extrato:criar')
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarDescricaoExtratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<DescricaoExtrato> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.criarDescricao.executar({ empresaId, ...dto });
  }

  @Patch(':id')
  @ExigirPermissao('descricoes_extrato:editar')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarDescricaoExtratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarDescricao.executar(id, empresaId, dto);
    return { ok: true };
  }

  @Delete(':id')
  @ExigirPermissao('descricoes_extrato:excluir')
  async excluir(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirDescricao.executar(id, empresaId);
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
