import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ExigirPermissao } from '../../auth/apresentacao/decorators/exigir-permissao.decorator';
import { Papeis } from '../../auth/apresentacao/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/apresentacao/decorators/usuario-atual.decorator';
import { PapeisGuard } from '../../auth/apresentacao/guards/papeis.guard';
import { PermissoesGuard } from '../../auth/apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { UsuarioAutenticado } from '../../auth/apresentacao/tipos/requisicao-autenticada';
import { Papel } from '../../auth/dominio/papel';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../auth/aplicacao/portas/usuarios-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { AjustarRegistrosDoDiaUseCase } from '../aplicacao/casos-de-uso/ajustar-registros-do-dia.usecase';
import { CancelarFeriasUseCase } from '../aplicacao/casos-de-uso/cancelar-ferias.usecase';
import { ConfigurarFuncionarioUseCase } from '../aplicacao/casos-de-uso/configurar-funcionario.usecase';
import { CriarFeriasUseCase } from '../aplicacao/casos-de-uso/criar-ferias.usecase';
import { ExcluirRegistroUseCase } from '../aplicacao/casos-de-uso/excluir-registro.usecase';
import { LancarFaltaOuAbonoUseCase } from '../aplicacao/casos-de-uso/lancar-falta-ou-abono.usecase';
import { LancarFolgaTrabalhadaUseCase } from '../aplicacao/casos-de-uso/lancar-folga-trabalhada.usecase';
import { ListarFeriasUseCase } from '../aplicacao/casos-de-uso/listar-ferias.usecase';
import { ListarRegistrosUseCase } from '../aplicacao/casos-de-uso/listar-registros.usecase';
import { ObterConfiguracaoFuncionarioUseCase } from '../aplicacao/casos-de-uso/obter-configuracao-funcionario.usecase';
import { ObterResumoMensalUseCase } from '../aplicacao/casos-de-uso/obter-resumo-mensal.usecase';
import { ObterUrlAtestadoUseCase } from '../aplicacao/casos-de-uso/obter-url-atestado.usecase';
import { ObterUrlSelfieUseCase, UrlArquivoPonto } from '../aplicacao/casos-de-uso/obter-url-selfie.usecase';
import { RegistrarBatidaUseCase } from '../aplicacao/casos-de-uso/registrar-batida.usecase';
import { exigirGestorSobre } from '../aplicacao/exigir-gestor-sobre';
import { ConfiguracaoFuncionario } from '../aplicacao/portas/configuracao-funcionario-repositorio.port';
import { FeriasPonto } from '../aplicacao/portas/ferias-ponto-repositorio.port';
import { RegistroPonto } from '../aplicacao/portas/registros-ponto-repositorio.port';
import { ResumoMensalPonto } from '../dominio/ponto';
import { AjustarRegistrosDoDiaDto } from './dto/ajustar-registros-do-dia.dto';
import { ConfigurarFuncionarioDto } from './dto/configurar-funcionario.dto';
import { CriarFeriasDto } from './dto/criar-ferias.dto';
import { LancarFaltaAbonoDto } from './dto/lancar-falta-abono.dto';
import { LancarFolgaTrabalhadaDto } from './dto/lancar-folga-trabalhada.dto';
import { RegistrarBatidaDto } from './dto/registrar-batida.dto';

const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024;
const PAPEIS_GESTORES = [Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO];

@Controller('ponto-eletronico')
@UseGuards(SupabaseAuthGuard, PapeisGuard, PermissoesGuard)
export class PontoEletronicoController {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly registrarBatida: RegistrarBatidaUseCase,
    private readonly listarRegistros: ListarRegistrosUseCase,
    private readonly obterResumoMensal: ObterResumoMensalUseCase,
    private readonly lancarFaltaOuAbono: LancarFaltaOuAbonoUseCase,
    private readonly lancarFolgaTrabalhada: LancarFolgaTrabalhadaUseCase,
    private readonly ajustarRegistrosDoDia: AjustarRegistrosDoDiaUseCase,
    private readonly excluirRegistro: ExcluirRegistroUseCase,
    private readonly configurarFuncionario: ConfigurarFuncionarioUseCase,
    private readonly obterConfiguracaoFuncionario: ObterConfiguracaoFuncionarioUseCase,
    private readonly criarFerias: CriarFeriasUseCase,
    private readonly listarFerias: ListarFeriasUseCase,
    private readonly cancelarFerias: CancelarFeriasUseCase,
    private readonly obterUrlSelfie: ObterUrlSelfieUseCase,
    private readonly obterUrlAtestado: ObterUrlAtestadoUseCase,
  ) {}

  @Post('batidas')
  @Papeis(Papel.OPERADOR_CONTADOR, Papel.OPERADOR_EMPRESA)
  @ExigirPermissao('ponto_eletronico:criar')
  @UseInterceptors(FileInterceptor('selfie', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async bater(
    @UploadedFile() selfie: Express.Multer.File | undefined,
    @Body() dto: RegistrarBatidaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<RegistroPonto> {
    if (!selfie) throw new NotFoundException('Selfie (campo "selfie") é obrigatória');

    return this.registrarBatida.executar({
      selfie: { nomeOriginal: selfie.originalname, buffer: selfie.buffer, contentType: selfie.mimetype },
      latitude: dto.latitude ? Number(dto.latitude) : null,
      longitude: dto.longitude ? Number(dto.longitude) : null,
      usuarioAtual,
    });
  }

  @Get('registros')
  @ExigirPermissao('ponto_eletronico:visualizar')
  async listar(
    @Query('usuarioId') usuarioIdConsulta: string | undefined,
    @Query('ano') anoConsulta: string | undefined,
    @Query('mes') mesConsulta: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<RegistroPonto[]> {
    const usuarioId = await this.resolverUsuarioAlvo(usuarioIdConsulta, usuarioAtual);
    const { ano, mes } = this.resolverAnoMes(anoConsulta, mesConsulta);
    return this.listarRegistros.executar(usuarioId, ano, mes);
  }

  @Get('resumo')
  @ExigirPermissao('ponto_eletronico:visualizar')
  async resumo(
    @Query('usuarioId') usuarioIdConsulta: string | undefined,
    @Query('ano') anoConsulta: string | undefined,
    @Query('mes') mesConsulta: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResumoMensalPonto> {
    const usuarioId = await this.resolverUsuarioAlvo(usuarioIdConsulta, usuarioAtual);
    const { ano, mes } = this.resolverAnoMes(anoConsulta, mesConsulta);
    return this.obterResumoMensal.executar(usuarioId, ano, mes);
  }

  @Post('falta-abono')
  @Papeis(...PAPEIS_GESTORES)
  @ExigirPermissao('ponto_eletronico:editar')
  @UseInterceptors(FileInterceptor('atestado', { storage: memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO } }))
  async faltaOuAbono(
    @UploadedFile() atestado: Express.Multer.File | undefined,
    @Body() dto: LancarFaltaAbonoDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.lancarFaltaOuAbono.executar({
      usuarioAlvoId: dto.usuarioAlvoId,
      data: dto.data,
      horasFalta: dto.horasFalta,
      horasAbono: dto.horasAbono,
      atestado: atestado ? { nomeOriginal: atestado.originalname, buffer: atestado.buffer, contentType: atestado.mimetype } : null,
      usuarioAtual,
    });
    return { ok: true };
  }

  @Post('folga-trabalhada')
  @Papeis(...PAPEIS_GESTORES)
  @ExigirPermissao('ponto_eletronico:editar')
  async folgaTrabalhada(@Body() dto: LancarFolgaTrabalhadaDto, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<{ ok: true }> {
    await this.lancarFolgaTrabalhada.executar({
      usuarioAlvoId: dto.usuarioAlvoId,
      data: dto.data,
      decisao: dto.decisao,
      dataCompensacaoFutura: dto.dataCompensacaoFutura ?? null,
      usuarioAtual,
    });
    return { ok: true };
  }

  @Put('dias/:usuarioAlvoId/:data')
  @Papeis(...PAPEIS_GESTORES)
  @ExigirPermissao('ponto_eletronico:editar')
  async ajustarDia(
    @Param('usuarioAlvoId', ParseUUIDPipe) usuarioAlvoId: string,
    @Param('data') data: string,
    @Body() dto: AjustarRegistrosDoDiaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    await this.ajustarRegistrosDoDia.executar({ usuarioAlvoId, data, batidas: dto.batidas, usuarioAtual });
    return { ok: true };
  }

  @Delete('registros/:id')
  @Papeis(...PAPEIS_GESTORES)
  @ExigirPermissao('ponto_eletronico:excluir')
  async excluir(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<{ ok: true }> {
    await this.excluirRegistro.executar(id, usuarioAtual);
    return { ok: true };
  }

  @Get('configuracao/:usuarioAlvoId')
  @ExigirPermissao('ponto_eletronico:visualizar')
  async obterConfiguracao(
    @Param('usuarioAlvoId', ParseUUIDPipe) usuarioAlvoId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ConfiguracaoFuncionario | null> {
    await this.resolverUsuarioAlvo(usuarioAlvoId, usuarioAtual);
    return this.obterConfiguracaoFuncionario.executar(usuarioAlvoId);
  }

  @Put('configuracao/:usuarioAlvoId')
  @Papeis(...PAPEIS_GESTORES)
  @ExigirPermissao('ponto_eletronico:editar')
  async atualizarConfiguracao(
    @Param('usuarioAlvoId', ParseUUIDPipe) usuarioAlvoId: string,
    @Body() dto: ConfigurarFuncionarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ConfiguracaoFuncionario> {
    return this.configurarFuncionario.executar(usuarioAlvoId, dto, usuarioAtual);
  }

  @Get('ferias')
  @ExigirPermissao('ponto_eletronico:visualizar')
  async ferias(@Query('usuarioId') usuarioIdConsulta: string | undefined, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<FeriasPonto[]> {
    const usuarioId = await this.resolverUsuarioAlvo(usuarioIdConsulta, usuarioAtual);
    return this.listarFerias.executar(usuarioId);
  }

  @Post('ferias')
  @Papeis(...PAPEIS_GESTORES)
  @ExigirPermissao('ponto_eletronico:criar')
  async criarPeriodoFerias(@Body() dto: CriarFeriasDto, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<FeriasPonto> {
    return this.criarFerias.executar({
      usuarioAlvoId: dto.usuarioAlvoId,
      dataInicio: dto.dataInicio,
      dataFim: dto.dataFim,
      periodoReferencia: dto.periodoReferencia ?? null,
      usuarioAtual,
    });
  }

  @Delete('ferias/:id')
  @Papeis(...PAPEIS_GESTORES)
  @ExigirPermissao('ponto_eletronico:excluir')
  async cancelarPeriodoFerias(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<{ ok: true }> {
    await this.cancelarFerias.executar(id, usuarioAtual);
    return { ok: true };
  }

  @Get('registros/:id/selfie-url')
  @ExigirPermissao('ponto_eletronico:visualizar')
  async urlSelfie(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<UrlArquivoPonto> {
    return this.obterUrlSelfie.executar(id, usuarioAtual);
  }

  @Get('registros/:id/atestado-url')
  @ExigirPermissao('ponto_eletronico:visualizar')
  async urlAtestado(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<UrlArquivoPonto> {
    return this.obterUrlAtestado.executar(id, usuarioAtual);
  }

  /** Sem usuarioIdConsulta = o próprio funcionário. Com valor diferente do próprio, exige ser gestor com posse sobre o alvo. */
  private async resolverUsuarioAlvo(usuarioIdConsulta: string | undefined, usuarioAtual: UsuarioAutenticado): Promise<string> {
    const alvoId = usuarioIdConsulta ?? usuarioAtual.id;
    if (alvoId !== usuarioAtual.id) {
      const funcionario = await this.usuariosRepositorio.buscarPorId(alvoId);
      if (!funcionario) throw new NotFoundException('Funcionário não encontrado');
      await exigirGestorSobre(usuarioAtual, funcionario, this.empresasRepositorio);
    }
    return alvoId;
  }

  private resolverAnoMes(anoConsulta: string | undefined, mesConsulta: string | undefined): { ano: number; mes: number } {
    const agora = new Date();
    return {
      ano: anoConsulta ? parseInt(anoConsulta, 10) : agora.getUTCFullYear(),
      mes: mesConsulta ? parseInt(mesConsulta, 10) : agora.getUTCMonth() + 1,
    };
  }
}
