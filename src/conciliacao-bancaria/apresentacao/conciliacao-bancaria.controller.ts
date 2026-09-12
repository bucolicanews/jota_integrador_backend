import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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
import { AtualizarContaResultadoUseCase } from '../aplicacao/casos-de-uso/atualizar-conta-resultado.usecase';
import { BuscarParcelasCandidatasUseCase, ParcelaCandidata } from '../aplicacao/casos-de-uso/buscar-parcelas-candidatas.usecase';
import { ConfirmarTransacoesUseCase } from '../aplicacao/casos-de-uso/confirmar-transacoes.usecase';
import { ExcluirConfiguracaoUseCase } from '../aplicacao/casos-de-uso/excluir-configuracao.usecase';
import { IgnorarTransacaoUseCase } from '../aplicacao/casos-de-uso/ignorar-transacao.usecase';
import { ListarConciliadasUseCase } from '../aplicacao/casos-de-uso/listar-conciliadas.usecase';
import { ListarConfiguracoesUseCase } from '../aplicacao/casos-de-uso/listar-configuracoes.usecase';
import { ListarHistoricoImportacoesUseCase } from '../aplicacao/casos-de-uso/listar-historico-importacoes.usecase';
import { ListarPendentesUseCase } from '../aplicacao/casos-de-uso/listar-pendentes.usecase';
import { DetalheImportacao, ObterDetalheImportacaoUseCase } from '../aplicacao/casos-de-uso/obter-detalhe-importacao.usecase';
import { PreVisualizarExtratoUseCase, ResultadoPreVisualizacao } from '../aplicacao/casos-de-uso/pre-visualizar-extrato.usecase';
import { RegistrarExtratoManualUseCase } from '../aplicacao/casos-de-uso/registrar-extrato-manual.usecase';
import { SalvarConfiguracaoUseCase } from '../aplicacao/casos-de-uso/salvar-configuracao.usecase';
import { ResultadoVinculo, VincularTransacaoParcelaUseCase } from '../aplicacao/casos-de-uso/vincular-transacao-parcela.usecase';
import { ConfiguracaoConciliacao, ImportacaoConciliacao, TransacaoConciliacao } from '../aplicacao/portas/conciliacao-repositorio.port';
import { AtualizarConfiguracaoDto } from './dto/atualizar-configuracao.dto';
import { AtualizarContaResultadoDto } from './dto/atualizar-conta-resultado.dto';
import { ConfirmarTransacoesDto } from './dto/confirmar-transacoes.dto';
import { PreVisualizarExtratoDto } from './dto/pre-visualizar-extrato.dto';
import { RegistrarExtratoManualDto } from './dto/registrar-extrato-manual.dto';
import { SalvarConfiguracaoDto } from './dto/salvar-configuracao.dto';
import { VincularParcelaDto } from './dto/vincular-parcela.dto';

const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024; // 10MB -- CSV de extrato, generoso o suficiente

@Controller('empresas/:empresaId/conciliacao-bancaria')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard, ModulosGuard)
@ExigirModulo('conciliacao_bancaria')
export class ConciliacaoBancariaController {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly salvarConfiguracao: SalvarConfiguracaoUseCase,
    private readonly listarConfiguracoes: ListarConfiguracoesUseCase,
    private readonly excluirConfiguracao: ExcluirConfiguracaoUseCase,
    private readonly preVisualizarExtrato: PreVisualizarExtratoUseCase,
    private readonly confirmarTransacoes: ConfirmarTransacoesUseCase,
    private readonly listarPendentes: ListarPendentesUseCase,
    private readonly listarConciliadas: ListarConciliadasUseCase,
    private readonly listarHistoricoImportacoes: ListarHistoricoImportacoesUseCase,
    private readonly obterDetalheImportacao: ObterDetalheImportacaoUseCase,
    private readonly atualizarContaResultado: AtualizarContaResultadoUseCase,
    private readonly ignorarTransacao: IgnorarTransacaoUseCase,
    private readonly buscarParcelasCandidatas: BuscarParcelasCandidatasUseCase,
    private readonly vincularTransacaoParcela: VincularTransacaoParcelaUseCase,
    private readonly registrarExtratoManual: RegistrarExtratoManualUseCase,
  ) {}

  // ---------------- Configurações ----------------

  @Get('configuracoes')
  @ExigirPermissao('conciliacao_bancaria:visualizar')
  async listarConfiguracoesRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('contaContabilId') contaContabilId: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ConfiguracaoConciliacao[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarConfiguracoes.executar(empresaId, contaContabilId);
  }

  @Post('configuracoes')
  @ExigirPermissao('conciliacao_bancaria:criar')
  async criarConfiguracao(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: SalvarConfiguracaoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ConfiguracaoConciliacao> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.salvarConfiguracao.criar({
      empresaId,
      contaContabilId: dto.contaContabilId,
      nomeConfiguracao: dto.nomeConfiguracao,
      mapeamento: dto.mapeamento,
      colunaTipoTransacao: dto.colunaTipoTransacao ?? null,
      valorCredito: dto.valorCredito ?? null,
    });
  }

  @Patch('configuracoes/:id')
  @ExigirPermissao('conciliacao_bancaria:editar')
  async atualizarConfiguracao(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarConfiguracaoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.salvarConfiguracao.atualizar(id, empresaId, dto);
    return { ok: true };
  }

  @Delete('configuracoes/:id')
  @ExigirPermissao('conciliacao_bancaria:excluir')
  async excluirConfiguracaoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.excluirConfiguracao.executar(id, empresaId);
    return { ok: true };
  }

  // ---------------- Import (preview + confirmação) ----------------

  @Post('preview')
  @ExigirPermissao('conciliacao_bancaria:criar')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async preview(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @Body() dto: PreVisualizarExtratoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoPreVisualizacao> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);

    if (!arquivo) {
      throw new BadRequestException('Arquivo do extrato (campo "arquivo") é obrigatório');
    }

    return this.preVisualizarExtrato.executar({
      empresaId,
      contaContabilId: dto.contaContabilId,
      usuarioId: usuarioAtual.id,
      nomeArquivo: arquivo.originalname,
      conteudoArquivo: arquivo.buffer.toString('utf-8'),
      mapeamento: this.parsearMapeamento(dto.mapeamento),
      colunaTipoTransacao: dto.colunaTipoTransacao ?? null,
      valorCredito: dto.valorCredito ?? null,
    });
  }

  @Post('extrato-manual')
  @ExigirPermissao('conciliacao_bancaria:criar')
  async registrarExtratoManualRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: RegistrarExtratoManualDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.registrarExtratoManual.executar({
      empresaId,
      contaContabilId: dto.contaContabilId,
      contaContabilResultadoId: dto.contaContabilResultadoId,
      tipo: dto.tipo,
      valor: dto.valor,
      dataCompetencia: dto.dataCompetencia,
      descricao: dto.descricao,
      identificacao: dto.identificacao ?? null,
      usuarioId: usuarioAtual.id,
    });
  }

  @Post('confirmar')
  @ExigirPermissao('conciliacao_bancaria:criar')
  async confirmar(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: ConfirmarTransacoesDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ) {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.confirmarTransacoes.executar({ empresaId, usuarioId: usuarioAtual.id, transacaoIds: dto.transacaoIds });
  }

  // ---------------- Pendências (triagem, equivalente a Mapeamento.tsx) ----------------

  @Get('pendentes')
  @ExigirPermissao('conciliacao_bancaria:visualizar')
  async pendentes(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('contaContabilId') contaContabilId: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<TransacaoConciliacao[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarPendentes.executar(empresaId, contaContabilId);
  }

  @Patch('transacoes/:id/conta-resultado')
  @ExigirPermissao('conciliacao_bancaria:editar')
  async atualizarContaResultadoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarContaResultadoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.atualizarContaResultado.executar(id, empresaId, dto.contaContabilResultadoId);
    return { ok: true };
  }

  @Post('transacoes/:id/ignorar')
  @ExigirPermissao('conciliacao_bancaria:editar')
  async ignorarTransacaoRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    await this.ignorarTransacao.executar(id, empresaId, usuarioAtual.id);
    return { ok: true };
  }

  // ---------------- Vínculo com parcelas de Contas a Pagar/Receber (equivalente ao "Mapear Agora") ----------------

  @Get('transacoes/:id/parcelas-candidatas')
  @ExigirPermissao('conciliacao_bancaria:visualizar')
  async parcelasCandidatas(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ParcelaCandidata[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.buscarParcelasCandidatas.executar(id, empresaId);
  }

  @Post('transacoes/:id/vincular-parcela')
  @ExigirPermissao('conciliacao_bancaria:criar')
  async vincularParcelaRota(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VincularParcelaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoVinculo> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosseDeContador(usuarioAtual, empresa);
    return this.vincularTransacaoParcela.executar({
      transacaoId: id,
      empresaId,
      usuarioId: usuarioAtual.id,
      parcelaId: dto.parcelaId,
      tipo: dto.tipo,
    });
  }

  // ---------------- Histórico (equivalente a HistoricoConciliacaoDialog.tsx) ----------------

  @Get('importacoes')
  @ExigirPermissao('conciliacao_bancaria:visualizar')
  async importacoes(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('contaContabilId') contaContabilId: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ImportacaoConciliacao[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarHistoricoImportacoes.executar(empresaId, contaContabilId);
  }

  @Get('importacoes/:id')
  @ExigirPermissao('conciliacao_bancaria:visualizar')
  async detalheImportacao(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<DetalheImportacao> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.obterDetalheImportacao.executar(id, empresaId);
  }

  // ---------------- Ledger (equivalente a Extratos.tsx) ----------------

  @Get('lancamentos')
  @ExigirPermissao('conciliacao_bancaria:visualizar')
  async lancamentosConciliados(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Query('contaContabilId') contaContabilId: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<TransacaoConciliacao[]> {
    const empresa = await this.buscarEmpresaOuFalhar(empresaId);
    this.exigirPosse(usuarioAtual, empresa);
    return this.listarConciliadas.executar(empresaId, contaContabilId);
  }

  // ---------------- Helpers ----------------

  private async buscarEmpresaOuFalhar(empresaId: string): Promise<Empresa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return empresa;
  }

  /** Leitura: contador dono, usuário da própria empresa, ou plataforma. */
  private exigirPosse(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;
    const ehContadorDono = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === empresa.contadorId;
    const ehDaPropriaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === empresa.id;
    if (!ehContadorDono && !ehDaPropriaEmpresa) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }

  /** Escrita (configuração, import, confirmação): só contador dono ou plataforma -- é trabalho de escritório contábil, mesmo critério de plano_contas/lancamentos_contabeis. */
  private exigirPosseDeContador(usuarioAtual: UsuarioAutenticado, empresa: Empresa): void {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) return;
    if (usuarioAtual.contadorId !== empresa.contadorId) {
      throw new ForbiddenException('Sem autoridade sobre esta empresa');
    }
  }

  /** `mapeamento` chega como JSON serializado (multipart não suporta objeto aninhado nativamente) -- parse manual + validação de forma, nunca confia no shape sem checar. */
  private parsearMapeamento(bruto: string): { data: string; descricao: string; valor?: string | null; credito?: string | null; debito?: string | null; identificacao?: string | null } {
    let objeto: unknown;
    try {
      objeto = JSON.parse(bruto);
    } catch {
      throw new BadRequestException('Campo "mapeamento" precisa ser um JSON válido');
    }
    if (typeof objeto !== 'object' || objeto === null) {
      throw new BadRequestException('Campo "mapeamento" precisa ser um objeto');
    }
    const mapeamento = objeto as Record<string, unknown>;
    if (typeof mapeamento.data !== 'string' || !mapeamento.data || typeof mapeamento.descricao !== 'string' || !mapeamento.descricao) {
      throw new BadRequestException('Campo "mapeamento" precisa informar ao menos "data" e "descricao"');
    }
    return {
      data: mapeamento.data,
      descricao: mapeamento.descricao,
      valor: typeof mapeamento.valor === 'string' ? mapeamento.valor : null,
      credito: typeof mapeamento.credito === 'string' ? mapeamento.credito : null,
      debito: typeof mapeamento.debito === 'string' ? mapeamento.debito : null,
      identificacao: typeof mapeamento.identificacao === 'string' ? mapeamento.identificacao : null,
    };
  }
}
