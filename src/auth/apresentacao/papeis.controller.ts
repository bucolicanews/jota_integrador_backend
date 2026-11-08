import { Body, Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { InfoPapel, Papel } from '../dominio/papel';
import { PERMISSOES_REPOSITORIO, Permissao, PermissoesRepositorioPort } from '../aplicacao/portas/permissoes-repositorio.port';
import { AtualizarPapelDto } from './dto/atualizar-papel.dto';
import { CriarPapelDto } from './dto/criar-papel.dto';
import { Papeis } from './decorators/papeis.decorator';
import { PapeisGuard } from './guards/papeis.guard';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

/**
 * CRUD de papéis customizados (/admin/papeis no frontend) -- criar/editar é só
 * SUPER_ADMIN (mesma autoridade de sempre sobre RBAC, ver docs/SEGURANCA.md). RLS em
 * `papeis`/`papel_permissoes` já exige `eh_super_admin()` como segunda camada pra
 * escrita (migration 0002), então mesmo um bug aqui não abriria escrita pra outro papel.
 *
 * Listar (GET) é mais aberto: CONTADOR_DONO/EMPRESARIO_DONO também precisam do catálogo
 * pra popular o select de "Papel" no próprio formulário de criar usuário
 * (GerenciarUsuarios.tsx) -- RLS de `papeis`/`permissoes` já permite select pra qualquer
 * autenticado (`using (true)`), catálogo de papel não é dado sensível.
 */
@Controller('auth/papeis')
@UseGuards(SupabaseAuthGuard, PapeisGuard)
export class PapeisController {
  constructor(@Inject(PERMISSOES_REPOSITORIO) private readonly permissoes: PermissoesRepositorioPort) {}

  /** Catálogo de papéis (sistema + customizados) -- alimenta a tabela de /admin/papeis e o select de "Papel" na criação de usuário. */
  @Get()
  @Papeis(Papel.SUPER_ADMIN, Papel.CONTADOR_DONO, Papel.EMPRESARIO_DONO)
  async listar(): Promise<InfoPapel[]> {
    return this.permissoes.listarPapeis();
  }

  /** Teto atual (papel_permissoes) desse papel -- preenche o checklist de edição (só a tela /admin/papeis usa, SUPER_ADMIN only). */
  @Get(':id/permissoes')
  @Papeis(Papel.SUPER_ADMIN)
  async obterPermissoes(@Param('id', ParseUUIDPipe) id: string): Promise<Permissao[]> {
    return this.permissoes.listarPermissoesDoPapel(id);
  }

  @Post()
  @Papeis(Papel.SUPER_ADMIN)
  async criar(@Body() dto: CriarPapelDto): Promise<InfoPapel> {
    return this.permissoes.criarPapel({
      nome: dto.nome,
      escopo: dto.escopo,
      descricao: dto.descricao ?? null,
      permissaoIds: dto.permissaoIds ?? [],
    });
  }

  /**
   * SUPER_ADMIN edita descrição+teto de QUALQUER papel, inclusive os 7 de sistema --
   * nome/escopo continuam imutáveis (nem chegam no `AtualizarPapelDto`), são usados em
   * ~45 pontos do código (`@Papeis(Papel.X)`, `ESCOPO_POR_PAPEL` já removido, etc) e
   * trocar isso por aqui quebraria esses pontos. Editar o teto global de um papel de
   * sistema (ex: ADMIN_FINANCEIRO) é intencional -- é exatamente o que controla o que um
   * usuário desse papel recebe automaticamente na criação (CriarUsuarioUseCase) e o teto
   * que `papel_permissoes_dono` usa como fallback.
   */
  @Put(':id')
  @Papeis(Papel.SUPER_ADMIN)
  async atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarPapelDto): Promise<InfoPapel> {
    const papel = await this.permissoes.buscarPapelPorId(id);
    if (!papel) {
      throw new NotFoundException('Papel não encontrado');
    }

    await this.permissoes.atualizarPapel(id, {
      descricao: dto.descricao ?? null,
      permissaoIds: dto.permissaoIds ?? [],
    });

    return (await this.permissoes.buscarPapelPorId(id))!;
  }
}
