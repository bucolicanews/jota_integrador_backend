import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AlterarAtivaContaContabilUseCase } from '../aplicacao/casos-de-uso/alterar-ativa-conta-contabil.usecase';
import { AtualizarContaContabilUseCase } from '../aplicacao/casos-de-uso/atualizar-conta-contabil.usecase';
import { CriarContaContabilUseCase } from '../aplicacao/casos-de-uso/criar-conta-contabil.usecase';
import { ExportarPlanoContasUseCase } from '../aplicacao/casos-de-uso/exportar-plano-contas.usecase';
import { ImportarPlanoContasUseCase } from '../aplicacao/casos-de-uso/importar-plano-contas.usecase';
import { ListarContasContabeisUseCase } from '../aplicacao/casos-de-uso/listar-contas-contabeis.usecase';
import { PlanoConta, ResultadoImportacaoPlanoContas } from '../aplicacao/portas/plano-contas-repositorio.port';
import { AtualizarContaContabilDto } from './dto/atualizar-conta-contabil.dto';
import { CriarContaContabilDto } from './dto/criar-conta-contabil.dto';

const TAMANHO_MAXIMO_ARQUIVO = 5 * 1024 * 1024; // 5MB -- CSV de plano de contas, generoso o suficiente

@Controller('empresas/:empresaId/plano-contas')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PlanoContasController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly criarConta: CriarContaContabilUseCase,
    private readonly listarContas: ListarContasContabeisUseCase,
    private readonly atualizarConta: AtualizarContaContabilUseCase,
    private readonly alterarAtiva: AlterarAtivaContaContabilUseCase,
    private readonly importarPlanoContas: ImportarPlanoContasUseCase,
    private readonly exportarPlanoContas: ExportarPlanoContasUseCase,
  ) {}

  @Get()
  async listar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PlanoConta[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarContas.executar(empresaId);
  }

  @Post()
  async criar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CriarContaContabilDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PlanoConta> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    return this.criarConta.executar({
      empresaId,
      codigo: dto.codigo,
      nome: dto.nome,
      grupo: dto.grupo,
      sintetica: dto.sintetica,
      contaPaiId: dto.contaPaiId ?? null,
      contaCaixaBanco: dto.contaCaixaBanco ?? false,
      tipoCaixaBanco: dto.tipoCaixaBanco ?? null,
      contaAReceber: dto.contaAReceber ?? false,
      contaAPagar: dto.contaAPagar ?? false,
    });
  }

  @Patch(':contaId')
  async atualizar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('contaId', ParseUUIDPipe) contaId: string,
    @Body() dto: AtualizarContaContabilDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    await this.atualizarConta.executar(contaId, dto);
    return { ok: true };
  }

  @Post(':contaId/desativar')
  async desativar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('contaId', ParseUUIDPipe) contaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    await this.alterarAtiva.executar(contaId, false);
    return { ok: true };
  }

  @Post(':contaId/reativar')
  async reativar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('contaId', ParseUUIDPipe) contaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    await this.alterarAtiva.executar(contaId, true);
    return { ok: true };
  }

  @Post('importar')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async importar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoImportacaoPlanoContas> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    if (!arquivo) {
      throw new BadRequestException('Arquivo CSV (campo "arquivo") é obrigatório');
    }

    return this.importarPlanoContas.executar(empresaId, arquivo.buffer.toString('utf-8'));
  }

  @Get('exportar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);

    const csv = await this.exportarPlanoContas.executar(empresaId);
    res.setHeader('Content-Disposition', `attachment; filename="plano-contas-${empresaId}.csv"`);
    return csv;
  }

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return empresa;
  }

  /** Leitura: contador dono, usuário da própria empresa, ou plataforma -- mesmo padrão de CertificadosController. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      return;
    }
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;

    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }

  /**
   * Escrita no plano de contas: só contador dono ou plataforma -- é trabalho de
   * escritório contábil, o empresário-cliente não edita a própria contabilidade
   * (mesmo critério de exigirPosseDeContador em EmpresasController, aplicado aqui à
   * mesma regra que já está na RLS de `plano_contas`).
   */
  private exigirPosseDeContador(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      return;
    }
    if (usuarioAtual.contadorId !== empresa.contadorId) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }
}
