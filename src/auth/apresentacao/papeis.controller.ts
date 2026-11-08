import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
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
 * PRIVADO da própria carteira (escopo contador); EMPRESARIO_DONO gerencia papel PRIVADO
 * da própria empresa (escopo empresa) -- nunca vê/edita o papel de outro dono. Dono é
 * SEMPRE derivado do `usuarioAtual` (JWT), nunca aceito do body (Zero Trust, mesmo
 * padrão de `resolverVinculoPermitido` em auth.controller.ts).
 *
 * RLS em `papeis`/`papel_permissoes` continua exigindo `eh_super_admin()` pra escrita
 * (migration 0002) -- não é o gate real aqui (repositório usa service-role), é defesa em
 * profundidade que ainda não foi generalizada pra reconhecer dono contador/empresa
 * (gap pré-existente, fora do escopo desta mudança).
 */
@Controller('auth/papeis')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PapeisController {
  constructor(@Inject(PERMISSOES_REPOSITORIO) private readonly permissoes: PermissoesRepositorioPort) {}

  private filtroDonoDe(usuarioAtual: UsuarioAutenticado): FiltroDonoPapel {
    if (usuarioAtual.papel === Papel.CONTADOR_DONO) {
      return { contadorId: usuarioAtual.contadorId, empresaId: null };
    }
    if (usuarioAtual.papel === Papel.EMPRESARIO_DONO) {
      return { contadorId: null, empresaId: usuarioAtual.empresaId };
    }
    return { contadorId: null, empresaId: null }; // SUPER_ADMIN -- só global
  }

  /** Catálogo de papéis (globais + os privados do próprio dono) -- alimenta a tabela de /admin/papeis e o select de "Papel" na criação de usuário. */
  @Get()
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async listar(@UsuarioAtual() usuarioAtual: UsuarioAutenticado): Promise<InfoPapel[]> {
    return this.permissoes.listarPapeis(this.filtroDonoDe(usuarioAtual));
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
    // Dono e escopo são FORÇADOS pelo papel de quem chama, nunca aceitos do body --
    // CONTADOR_DONO só cria papel pra própria carteira (escopo contador), EMPRESARIO_DONO
    // só pra própria empresa (escopo empresa). SUPER_ADMIN mantém o comportamento
    // original: cria papel GLOBAL com o escopo que escolher.
    let escopo: EscopoPapel;
    let contadorId: string | null = null;
    let empresaId: string | null = null;

    if (usuarioAtual.papel === Papel.CONTADOR_DONO) {
      escopo = 'contador';
      contadorId = usuarioAtual.contadorId;
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
   * SUPER_ADMIN edita descrição+teto de qualquer papel GLOBAL, inclusive os 7 de sistema
   * -- nome/escopo continuam imutáveis (nem chegam no `AtualizarPapelDto`), são usados em
   * ~45 pontos do código (`@Papeis(Papel.X)` etc) e trocar isso por aqui quebraria esses
   * pontos. CONTADOR_DONO/EMPRESARIO_DONO só editam o PRÓPRIO papel privado -- nunca o
   * global nem o de outro dono.
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
      descricao: dto.descricao ?? null,
      permissaoIds: dto.permissaoIds ?? [],
    });

    return (await this.permissoes.buscarPapelPorId(id))!;
  }

  /** SUPER_ADMIN só age sobre papel global; CONTADOR_DONO/EMPRESARIO_DONO só sobre o próprio -- nunca o de outro dono nem o global. */
  private async exigirPosseOuGlobal(papelId: string, usuarioAtual: UsuarioAutenticado): Promise<void> {
    const papel = await this.permissoes.buscarPapelPorId(papelId);
    if (!papel) {
      throw new NotFoundException('Papel não encontrado');
    }

    if (usuarioAtual.papel === Papel.CONTADOR_DONO) {
      if (papel.contadorId !== usuarioAtual.contadorId) {
        throw new ForbiddenException('Este papel não pertence à sua carteira');
      }
      return;
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
