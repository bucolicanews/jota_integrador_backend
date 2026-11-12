import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { EscopoPapel, InfoPapel, Papel } from '../dominio/papel';
import { FiltroDonoPapel, PERMISSOES_REPOSITORIO, Permissao, PermissoesRepositorioPort } from '../aplicacao/portas/permissoes-repositorio.port';
import { AtualizarPapelDto } from './dto/atualizar-papel.dto';
import { CriarPapelDto } from './dto/criar-papel.dto';
import { UsuarioAtual } from './decorators/usuario-atual.decorator';
import { Papeis } from './decorators/papeis.decorator';
import { PapeisGuard } from './guards/papeis.guard';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { UsuarioAutenticado } from './tipos/requisicao-autenticada';

/**
 * CRUD de papéis customizados (/admin/papeis no frontend). SUPER_ADMIN gerencia papel
 * GLOBAL (visível/usável por qualquer contador/empresa); CONTADOR_DONO gerencia papel
 * PRIVADO da própria carteira (escopo contador) -- e, opcionalmente, papel PRIVADO de uma
 * empresa-cliente da própria carteira (escopo empresa, "em nome dela", via `empresaId` na
 * query/body); EMPRESARIO_DONO gerencia papel PRIVADO da própria empresa (escopo empresa).
 * Nunca vê/edita o papel de outro dono fora dessa autoridade. Dono é SEMPRE derivado do
 * `usuarioAtual` (JWT) + posse confirmada contra a carteira real, nunca aceito cru do
 * body (Zero Trust, mesmo padrão de `resolverVinculoPermitido` em auth.controller.ts).
 *
 * RLS em `papeis`/`papel_permissoes` continua exigindo `eh_super_admin()` pra escrita
 * (migration 0002) -- não é o gate real aqui (repositório usa service-role), é defesa em
 * profundidade que ainda não foi generalizada pra reconhecer dono contador/empresa
 * (gap pré-existente, fora do escopo desta mudança).
 */
@Controller('auth/papeis')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PapeisController {
  constructor(
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoes: PermissoesRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresas: EmpresasRepositorioPort,
  ) {}

  /**
   * Resolve o filtro de dono pra listar -- se CONTADOR_DONO pedir `empresaIdConsulta`
   * (agindo em nome de um cliente da própria carteira), confirma posse e troca pro
   * filtro daquela empresa em vez do próprio contador.
   */
  private async filtroDonoDe(usuarioAtual: UsuarioAutenticado, empresaIdConsulta: string | undefined): Promise<FiltroDonoPapel> {
    if (usuarioAtual.papel === Papel.CONTADOR_DONO) {
      if (empresaIdConsulta) {
        await this.exigirEmpresaDaCarteira(empresaIdConsulta, usuarioAtual.contadorId!);
        return { contadorId: null, empresaId: empresaIdConsulta };
      }
      return { contadorId: usuarioAtual.contadorId, empresaId: null };
    }
    if (usuarioAtual.papel === Papel.EMPRESARIO_DONO) {
      return { contadorId: null, empresaId: usuarioAtual.empresaId };
    }
    return { contadorId: null, empresaId: null }; // SUPER_ADMIN -- só global
  }

  /** Catálogo de papéis (globais + os privados do dono, ou da empresa-cliente informada) -- alimenta a tabela de /admin/papeis e o select de "Papel" na criação de usuário. */
  @Get()
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async listar(
    @Query('empresaId') empresaIdConsulta: string | undefined,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<InfoPapel[]> {
    return this.permissoes.listarPapeis(await this.filtroDonoDe(usuarioAtual, empresaIdConsulta));
  }

  /** Teto atual (papel_permissoes) desse papel -- preenche o checklist de edição. */
  @Get(':id/permissoes')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async obterPermissoes(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<Permissao[]> {
    await this.exigirPosseOuGlobal(id, usuarioAtual);
    return this.permissoes.listarPermissoesDoPapel(id);
  }

  @Post()
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async criar(@Body() dto: CriarPapelDto, @UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<InfoPapel> {
    // Dono e escopo são FORÇADOS pelo papel de quem chama (+ posse confirmada quando
    // aplicável), nunca aceitos crus do body -- CONTADOR_DONO cria pra própria carteira
    // (escopo contador) OU, se informar `empresaId`, em nome de um cliente da própria
    // carteira (escopo empresa, posse confirmada); EMPRESARIO_DONO só pra própria empresa.
    // SUPER_ADMIN mantém o comportamento original: cria papel GLOBAL com o escopo que escolher.
    let escopo: EscopoPapel;
    let contadorId: string | null = null;
    let empresaId: string | null = null;

    if (usuarioAtual.papel === Papel.CONTADOR_DONO) {
      if (dto.empresaId) {
        await this.exigirEmpresaDaCarteira(dto.empresaId, usuarioAtual.contadorId!);
        escopo = 'empresa';
        empresaId = dto.empresaId;
      } else {
        escopo = 'contador';
        contadorId = usuarioAtual.contadorId;
      }
    } else if (usuarioAtual.papel === Papel.EMPRESARIO_DONO) {
      escopo = 'empresa';
      empresaId = usuarioAtual.empresaId;
    } else {
      if (!dto.escopo) {
        throw new BadRequestException('escopo é obrigatório pra papel global');
      }
      escopo = dto.escopo;
    }

    return this.permissoes.criarPapel({
      nome: dto.nome,
      escopo,
      descricao: dto.descricao ?? null,
      permissaoIds: dto.permissaoIds ?? [],
      contadorId,
      empresaId,
    });
  }

  /**
   * SUPER_ADMIN edita nome/escopo/descrição/teto de qualquer papel GLOBAL, inclusive os 7
   * de sistema (pedido explícito 2026-11-12, revertendo a trava original da migration
   * 20261108000002). RISCO ACEITO E DOCUMENTADO: `Papel.SUPER_ADMIN` etc são string
   * literals hardcoded em ~45-60 `@Papeis(Papel.X)` pelo código -- renomear a linha de um
   * desses 7 aqui NÃO atualiza esses literais, e todo usuário com esse papel passa a
   * carregar um `nome` que não bate com nenhuma checagem (perde acesso, sem aviso, até
   * reverter manualmente no banco). Trocar `escopo` de um papel de sistema (sempre
   * global: contador_id/empresa_id null) também não quebra na hora, mas qualquer
   * atribuição futura a esse papel falha em `validarCoerenciaEscopo` (exige vínculo
   * incompatível com o vínculo null daquela linha). CONTADOR_DONO edita o próprio papel
   * privado OU o de uma empresa-cliente da própria carteira (posse confirmada);
   * EMPRESARIO_DONO só o próprio.
   */
  @Put(':id')
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarPapelDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<InfoPapel> {
    await this.exigirPosseOuGlobal(id, usuarioAtual);

    await this.permissoes.atualizarPapel(id, {
      nome: dto.nome,
      escopo: dto.escopo,
      descricao: dto.descricao ?? null,
      permissaoIds: dto.permissaoIds ?? [],
    });

    return (await this.permissoes.buscarPapelPorId(id))!;
  }

  /** Lança se a empresa não pertence à carteira deste contador -- Zero Trust, `empresaId` pode ter vindo de query/body cru. */
  private async exigirEmpresaDaCarteira(empresaId: string, contadorId: string): Promise<void> {
    const pertence = await this.empresas.pertenceAoContador(empresaId, contadorId);
    if (!pertence) {
      throw new ForbiddenException('Esta empresa não pertence à sua carteira');
    }
  }

  /**
   * SUPER_ADMIN só age sobre papel global; EMPRESARIO_DONO só sobre o próprio; CONTADOR_DONO
   * sobre o próprio OU o de qualquer empresa da própria carteira -- nunca o de outro dono.
   */
  private async exigirPosseOuGlobal(papelId: string, usuarioAtual: UsuarioAutenticado): Promise<void> {
    const papel = await this.permissoes.buscarPapelPorId(papelId);
    if (!papel) {
      throw new NotFoundException('Papel não encontrado');
    }

    if (usuarioAtual.papel === Papel.CONTADOR_DONO) {
      if (papel.contadorId === usuarioAtual.contadorId) return;
      if (papel.empresaId) {
        const pertence = await this.empresas.pertenceAoContador(papel.empresaId, usuarioAtual.contadorId!);
        if (pertence) return;
      }
      throw new ForbiddenException('Este papel não pertence à sua carteira');
    }
    if (usuarioAtual.papel === Papel.EMPRESARIO_DONO) {
      if (papel.empresaId !== usuarioAtual.empresaId) {
        throw new ForbiddenException('Este papel não pertence à sua empresa');
      }
      return;
    }
    // SUPER_ADMIN -- só o global (sistema ou customizado-global).
    if (papel.contadorId !== null || papel.empresaId !== null) {
      throw new ForbiddenException('Papel privado de outro dono -- gerencie pela carteira/empresa correspondente');
    }
  }
}
