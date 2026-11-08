import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { InfoPapel, Papel } from '../dominio/papel';
import { AtualizarAvatarProprioUseCase } from '../aplicacao/casos-de-uso/atualizar-avatar-proprio.usecase';
import { AtualizarEmailUsuarioUseCase } from '../aplicacao/casos-de-uso/atualizar-email-usuario.usecase';
import { AtualizarNomeProprioUseCase } from '../aplicacao/casos-de-uso/atualizar-nome-proprio.usecase';
import { AtualizarPapelUsuarioUseCase } from '../aplicacao/casos-de-uso/atualizar-papel-usuario.usecase';
import { AtualizarSenhaUsuarioUseCase } from '../aplicacao/casos-de-uso/atualizar-senha-usuario.usecase';
import { AtualizarTetoPermissoesUseCase } from '../aplicacao/casos-de-uso/atualizar-teto-permissoes.usecase';
import { BloquearUsuarioUseCase } from '../aplicacao/casos-de-uso/bloquear-usuario.usecase';
import { ConcederPermissaoUseCase } from '../aplicacao/casos-de-uso/conceder-permissao.usecase';
import { CriarUsuarioUseCase, ResultadoCriarUsuario } from '../aplicacao/casos-de-uso/criar-usuario.usecase';
import { DesbloquearUsuarioUseCase } from '../aplicacao/casos-de-uso/desbloquear-usuario.usecase';
import { GerarLinkAcessoUseCase } from '../aplicacao/casos-de-uso/gerar-link-acesso.usecase';
import { ListarPermissoesUsuarioUseCase, PermissoesDoUsuario } from '../aplicacao/casos-de-uso/listar-permissoes-usuario.usecase';
import { ListarUsuariosUseCase } from '../aplicacao/casos-de-uso/listar-usuarios.usecase';
import { LogoutGlobalUseCase } from '../aplicacao/casos-de-uso/logout-global.usecase';
import { ObterPerfilUseCase } from '../aplicacao/casos-de-uso/obter-perfil.usecase';
import { ObterTetoPermissoesUseCase } from '../aplicacao/casos-de-uso/obter-teto-permissoes.usecase';
import { PERMISSOES_REPOSITORIO, Permissao, PermissoesRepositorioPort } from '../aplicacao/portas/permissoes-repositorio.port';
import { RevogarPermissaoUseCase } from '../aplicacao/casos-de-uso/revogar-permissao.usecase';
import { USUARIOS_REPOSITORIO, Usuario, UsuariosRepositorioPort } from '../aplicacao/portas/usuarios-repositorio.port';
import { AtualizarEmailUsuarioDto } from './dto/atualizar-email-usuario.dto';
import { AtualizarPapelUsuarioDto } from './dto/atualizar-papel-usuario.dto';
import { AtualizarSenhaUsuarioDto } from './dto/atualizar-senha-usuario.dto';
import { AtualizarTetoPermissoesDto } from './dto/atualizar-teto-permissoes.dto';
import { AtualizarPerfilProprioDto } from './dto/atualizar-perfil-proprio.dto';
import { BloquearUsuarioDto } from './dto/bloquear-usuario.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { Papeis } from './decorators/papeis.decorator';
import { UsuarioAtual } from './decorators/usuario-atual.decorator';
import { PapeisGuard } from './guards/papeis.guard';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { UsuarioAutenticado } from './tipos/requisicao-autenticada';

@Controller('auth')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class AuthController {
  constructor(
    private readonly criarUsuario: CriarUsuarioUseCase,
    private readonly atualizarNomeProprio: AtualizarNomeProprioUseCase,
    private readonly atualizarEmailUsuario: AtualizarEmailUsuarioUseCase,
    private readonly atualizarSenhaUsuario: AtualizarSenhaUsuarioUseCase,
    private readonly atualizarAvatarProprio: AtualizarAvatarProprioUseCase,
    private readonly atualizarPapelUsuario: AtualizarPapelUsuarioUseCase,
    private readonly bloquearUsuario: BloquearUsuarioUseCase,
    private readonly desbloquearUsuario: DesbloquearUsuarioUseCase,
    private readonly gerarLinkAcesso: GerarLinkAcessoUseCase,
    private readonly obterPerfil: ObterPerfilUseCase,
    private readonly logoutGlobal: LogoutGlobalUseCase,
    private readonly listarPermissoesUsuario: ListarPermissoesUsuarioUseCase,
    private readonly listarUsuarios: ListarUsuariosUseCase,
    private readonly concederPermissao: ConcederPermissaoUseCase,
    private readonly revogarPermissao: RevogarPermissaoUseCase,
    private readonly obterTetoPermissoes: ObterTetoPermissoesUseCase,
    private readonly atualizarTetoPermissoes: AtualizarTetoPermissoesUseCase,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoesRepositorio: PermissoesRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
  ) {}

  /**
   * Catálogo completo (todos os recursos/ações cadastrados), sem filtrar por teto de
   * papel nenhum -- usado por "Editar plano" (permissoesPadrao) e qualquer outra tela
   * que precise montar um checklist genérico, inclusive o form de criar/editar papel em
   * /admin/papeis pra CONTADOR_DONO/EMPRESARIO_DONO (desde 2026-11-09).
   */
  @Get('permissoes-catalogo')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async listarCatalogoPermissoes(): Promise<Permissao[]> {
    return this.permissoesRepositorio.listarCatalogoPermissoes();
  }

  @Get('me')
  async me(@UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<Usuario> {
    return this.obterPerfil.executar(usuarioAtual.id);
  }

  /** Auto-serviço: qualquer papel autenticado edita o próprio nome. Sem `@Papeis(...)` de propósito -- diferente das rotas administrativas abaixo, aqui não há vínculo alheio a proteger. */
  @Patch('me')
  async atualizarMeuPerfil(
    @Body() dto: AtualizarPerfilProprioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Usuario> {
    return this.atualizarNomeProprio.executar(usuarioAtual.id, dto.nome);
  }

  /** Auto-serviço: qualquer papel autenticado troca o próprio e-mail de login. Senha é trocada direto pelo client via `supabase.auth.updateUser` (nunca passa por aqui). */
  @Patch('me/email')
  async atualizarMeuEmail(
    @Body() dto: AtualizarEmailUsuarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Usuario> {
    return this.atualizarEmailUsuario.executar(usuarioAtual.id, dto.novoEmail);
  }

  /** Auto-serviço: qualquer papel autenticado troca a própria foto de perfil. 2MB, JPG/PNG/WEBP. */
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  async atualizarMeuAvatar(
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Usuario> {
    if (!arquivo) {
      throw new BadRequestException('Arquivo da imagem (campo "arquivo") é obrigatório');
    }
    return this.atualizarAvatarProprio.executar(usuarioAtual.id, {
      buffer: arquivo.buffer,
      mimetype: arquivo.mimetype,
      size: arquivo.size,
    });
  }

  /** Une "meus funcionários" (escopo contador) + "funcionários dos clientes" (escopo empresa) numa lista só -- o frontend agrupa visualmente por vínculo. */
  @Get('usuarios')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async listar(
    @Query('contadorId') contadorIdConsulta: string | undefined,
    @Query('empresaId') empresaIdConsulta: string | undefined,
    @Query('plataforma') plataformaConsulta: string | undefined,
    @Query('somenteProprio') somenteProprioConsulta: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Usuario[]> {
    if (usuarioAtual.papel === Papel.EMPRESARIO_DONO) {
      return this.listarUsuarios.executar({ contadorId: null, empresaIdUnico: usuarioAtual.empresaId });
    }

    if (usuarioAtual.papel === Papel.SUPER_ADMIN && plataformaConsulta === 'true') {
      return this.listarUsuarios.executar({ contadorId: null, empresaIdUnico: null, plataforma: true });
    }

    const contadorId = usuarioAtual.papel === Papel.SUPER_ADMIN ? (contadorIdConsulta ?? null) : usuarioAtual.contadorId;
    const empresaIdUnico = empresaIdConsulta ?? null;

    if (!contadorId && !empresaIdUnico) {
      throw new BadRequestException('contadorId ou empresaId é obrigatório (via query, quando plataforma)');
    }

    return this.listarUsuarios.executar({ contadorId, empresaIdUnico, somenteProprio: somenteProprioConsulta === 'true' });
  }

  @Post('logout-global')
  async logout(@UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<{ ok: true }> {
    await this.logoutGlobal.executar(usuarioAtual.id);
    return { ok: true };
  }

  @Post('usuarios')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async criar(
    @Body() dto: CriarUsuarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<ResultadoCriarUsuario> {
    const vinculo = await this.resolverVinculoPermitido(
      usuarioAtual,
      dto.papel,
      dto.contadorId ?? null,
      dto.empresaId ?? null,
    );

    return this.criarUsuario.executar({
      nome: dto.nome,
      email: dto.email,
      infoPapel: vinculo.infoPapel,
      contadorId: vinculo.contadorId,
      empresaId: vinculo.empresaId,
    });
  }

  /** Reemite o link pra um usuário que já existe -- nunca recebeu o convite, perdeu, etc. */
  @Post('usuarios/:id/link-acesso')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async reemitirLinkAcesso(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ linkAcesso: string }> {
    const alvo = await this.obterPerfil.executar(id);
    await this.exigirAutoridadeSobre(usuarioAtual, alvo);

    return this.gerarLinkAcesso.executar(id);
  }

  /**
   * Teto de permissões dos FUNCIONÁRIOS deste dono (contador -> OPERADOR_CONTADOR,
   * empresa -> OPERADOR_EMPRESA, plataforma -> ADMIN_FINANCEIRO/ADMIN_SUPORTE via query
   * `papel`, já que plataforma tem dois papéis configuráveis). Nunca o papel do próprio
   * chamador (dono já tem acesso total dentro do próprio escopo, não precisa de teto).
   */
  @Get('teto-permissoes')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async obterTetoPermissoesRota(
    @Query('papel') papelQuery: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ papel: Papel; catalogo: Permissao[]; selecionadas: string[] }> {
    const { papel, contadorId, empresaId } = this.resolverPapelConfiguravel(usuarioAtual, papelQuery);
    const resultado = await this.obterTetoPermissoes.executar(papel, contadorId, empresaId);
    return { papel, ...resultado };
  }

  @Put('teto-permissoes')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async atualizarTetoPermissoesRota(
    @Query('papel') papelQuery: string | undefined,
    @Body() dto: AtualizarTetoPermissoesDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const { papel, contadorId, empresaId } = this.resolverPapelConfiguravel(usuarioAtual, papelQuery);
    await this.atualizarTetoPermissoes.executar(papel, contadorId, empresaId, dto.permissaoIds, usuarioAtual.id);
    return { ok: true };
  }

  private resolverPapelConfiguravel(
    usuarioAtual: UsuarioAutenticado,
    papelQuery: string | undefined,
  ): { papel: Papel; contadorId: string | null; empresaId: string | null } {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      if (papelQuery !== Papel.ADMIN_FINANCEIRO && papelQuery !== Papel.ADMIN_SUPORTE) {
        throw new BadRequestException('Query "papel" deve ser ADMIN_FINANCEIRO ou ADMIN_SUPORTE');
      }
      return { papel: papelQuery, contadorId: null, empresaId: null };
    }
    if (usuarioAtual.papel === Papel.CONTADOR_DONO) {
      return { papel: Papel.OPERADOR_CONTADOR, contadorId: usuarioAtual.contadorId, empresaId: null };
    }
    if (usuarioAtual.papel === Papel.EMPRESARIO_DONO) {
      return { papel: Papel.OPERADOR_EMPRESA, contadorId: null, empresaId: usuarioAtual.empresaId };
    }
    throw new ForbiddenException('Sem autoridade para configurar teto de permissões');
  }

  @Patch('usuarios/:id/papel')
  @Papeis(Papel.SUPER_ADMIN) // TODO: permitir CONTADOR_DONO gerenciar papel dos próprios OPERADOR_CONTADOR
  async atualizarPapel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarPapelUsuarioDto,
  ): Promise<{ ok: true }> {
    await this.atualizarPapelUsuario.executar({
      usuarioId: id,
      novoPapel: dto.papel,
      novoContadorId: dto.contadorId ?? null,
      novoEmpresaId: dto.empresaId ?? null,
    });
    return { ok: true };
  }

  /** Admin-on-behalf: SUPER_ADMIN troca o e-mail de login de qualquer usuário; contador/empresa só do próprio vínculo (mesma autoridade de bloquear/desbloquear). */
  @Patch('usuarios/:id/email')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async atualizarEmailDeUsuario(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarEmailUsuarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Usuario> {
    const alvo = await this.obterPerfil.executar(id);
    await this.exigirAutoridadeSobre(usuarioAtual, alvo);

    return this.atualizarEmailUsuario.executar(id, dto.novoEmail);
  }

  /** Admin-on-behalf: SUPER_ADMIN define a senha de qualquer usuário; contador/empresa só do próprio vínculo. Nunca existe rota `/me/senha` -- o próprio usuário troca a senha direto no client (`supabase.auth.updateUser`). */
  @Patch('usuarios/:id/senha')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async atualizarSenhaDeUsuario(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarSenhaUsuarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const alvo = await this.obterPerfil.executar(id);
    await this.exigirAutoridadeSobre(usuarioAtual, alvo);

    await this.atualizarSenhaUsuario.executar(id, dto.novaSenha);
    return { ok: true };
  }

  @Post('usuarios/:id/bloquear')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async bloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BloquearUsuarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const alvo = await this.obterPerfil.executar(id);
    await this.exigirAutoridadeSobre(usuarioAtual, alvo);

    await this.bloquearUsuario.executar(id, dto.motivo, usuarioAtual.id);
    return { ok: true };
  }

  @Post('usuarios/:id/desbloquear')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async desbloquear(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const alvo = await this.obterPerfil.executar(id);
    await this.exigirAutoridadeSobre(usuarioAtual, alvo);

    await this.desbloquearUsuario.executar(id, usuarioAtual.id);
    return { ok: true };
  }

  /** Teto do papel (o que pode ser concedido) + o que já foi concedido -- monta a UI de checkboxes de "funcionário com restrição". */
  @Get('usuarios/:id/permissoes')
  @Papeis(Papel.SUPER_ADMIN, Papel.ADMIN_FINANCEIRO, Papel.ADMIN_SUPORTE, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async listarPermissoes(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<PermissoesDoUsuario> {
    const alvo = await this.obterPerfil.executar(id);
    await this.exigirAutoridadeSobre(usuarioAtual, alvo);
    return this.listarPermissoesUsuario.executar(alvo);
  }

  @Put('usuarios/:id/permissoes/:permissaoId')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async concederPermissaoRota(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissaoId', ParseUUIDPipe) permissaoId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const alvo = await this.obterPerfil.executar(id);
    await this.exigirAutoridadeSobre(usuarioAtual, alvo);
    await this.concederPermissao.executar(alvo, permissaoId, usuarioAtual.id);
    return { ok: true };
  }

  @Delete('usuarios/:id/permissoes/:permissaoId')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async revogarPermissaoRota(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissaoId', ParseUUIDPipe) permissaoId: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<{ ok: true }> {
    const alvo = await this.obterPerfil.executar(id);
    await this.exigirAutoridadeSobre(usuarioAtual, alvo);
    await this.revogarPermissao.executar(alvo, permissaoId, usuarioAtual.id);
    return { ok: true };
  }

  /**
   * Restringe o vínculo (contadorId/empresaId) ao que o usuário atual tem autoridade
   * de criar -- nunca confia no que veio no DTO pra quem não é plataforma (Zero Trust).
   * Um CONTADOR_DONO pode criar tanto usuário de escopo `contador` (pro próprio
   * escritório) quanto `empresa` (pra uma empresa da própria carteira, checado via
   * EmpresasRepositorioPort -- resolve a limitação v1 documentada no commit anterior,
   * agora que o módulo `empresas/` existe).
   */
  private async resolverVinculoPermitido(
    usuarioAtual: UsuarioAutenticado,
    papelNovo: Papel,
    contadorIdSolicitado: string | null,
    empresaIdSolicitado: string | null,
  ): Promise<{ contadorId: string | null; empresaId: string | null; infoPapel: InfoPapel }> {
    // Resolve o papel dentro do escopo do PRÓPRIO ATOR (nunca do alvo, que ainda nem foi
    // decidido) -- SUPER_ADMIN só vê papel global aqui (forma genérica não tem campo de
    // "qual contador", mesma limitação de sempre); CONTADOR_DONO vê global + o próprio;
    // EMPRESARIO_DONO vê global + o próprio. Nome não é mais único global, resolver sem
    // esse filtro seria ambíguo entre donos diferentes.
    const filtroAtor =
      usuarioAtual.papel === Papel.CONTADOR_DONO
        ? { contadorId: usuarioAtual.contadorId, empresaId: null }
        : usuarioAtual.papel === Papel.EMPRESARIO_DONO
          ? { contadorId: null, empresaId: usuarioAtual.empresaId }
          : { contadorId: null, empresaId: null };

    const infoPapel = await this.usuariosRepositorio.buscarPapelPorNome(papelNovo, filtroAtor);

    if (usuarioAtual.papel === Papel.SUPER_ADMIN) {
      return { contadorId: contadorIdSolicitado, empresaId: empresaIdSolicitado, infoPapel };
    }

    const escopoNovo = infoPapel.escopo;

    if (usuarioAtual.papel === Papel.CONTADOR_DONO && escopoNovo === 'contador') {
      return { contadorId: usuarioAtual.contadorId, empresaId: null, infoPapel };
    }

    if (usuarioAtual.papel === Papel.CONTADOR_DONO && escopoNovo === 'empresa') {
      if (!empresaIdSolicitado || !usuarioAtual.contadorId) {
        throw new ForbiddenException('empresaId é obrigatório para criar usuário de escopo empresa');
      }
      const pertence = await this.empresasRepositorio.pertenceAoContador(
        empresaIdSolicitado,
        usuarioAtual.contadorId,
      );
      if (!pertence) {
        throw new ForbiddenException('Esta empresa não pertence à sua carteira');
      }
      return { contadorId: null, empresaId: empresaIdSolicitado, infoPapel };
    }

    if (usuarioAtual.papel === Papel.EMPRESARIO_DONO && escopoNovo === 'empresa') {
      return { contadorId: null, empresaId: usuarioAtual.empresaId, infoPapel };
    }

    throw new ForbiddenException('Sem autoridade para criar usuário com este papel/vínculo');
  }

  /**
   * Ninguém além da plataforma age sobre usuário fora do próprio contador/empresa --
   * exceto o caso comum de "alvo é o login do EMPRESARIO_DONO/OPERADOR_EMPRESA de uma
   * empresa-cliente da carteira deste contador" (vínculo via empresa, não contador_id
   * direto, mesma checagem de posse que `ListarUsuariosUseCase` já faz na listagem --
   * sem isso, contador via o login do próprio cliente na lista mas não conseguia agir
   * sobre ele, 403 em bloquear/desbloquear/link-acesso/e-mail/senha).
   */
  private async exigirAutoridadeSobre(usuarioAtual: UsuarioAutenticado, alvo: Usuario): Promise<void> {
    if (usuarioAtual.papel === Papel.SUPER_ADMIN || usuarioAtual.id === alvo.id) {
      // Agir sobre si mesmo nunca passa por aqui -- contador/empresário dono já caem no
      // mesmoContador/mesmaEmpresa abaixo (contador_id/empresa_id batem com o próprio), mas
      // ADMIN_FINANCEIRO/ADMIN_SUPORTE (plataforma, ambos null) nunca bateriam -- MenuLateral
      // consultando a PRÓPRIA lista de permissões (GET .../permissoes) dava 403 sem isso.
      return;
    }
    const mesmoContador = usuarioAtual.contadorId !== null && usuarioAtual.contadorId === alvo.contadorId;
    const mesmaEmpresa = usuarioAtual.empresaId !== null && usuarioAtual.empresaId === alvo.empresaId;

    if (mesmoContador || mesmaEmpresa) {
      return;
    }

    if (usuarioAtual.contadorId !== null && alvo.empresaId !== null) {
      const pertence = await this.empresasRepositorio.pertenceAoContador(alvo.empresaId, usuarioAtual.contadorId);
      if (pertence) {
        return;
      }
    }

    throw new ForbiddenException('Sem autoridade sobre este usuário');
  }
}
