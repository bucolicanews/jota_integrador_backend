import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { PERMISSOES_REPOSITORIO, PermissoesRepositorioPort } from '../portas/permissoes-repositorio.port';
import { USUARIOS_REPOSITORIO, Usuario, UsuariosRepositorioPort } from '../portas/usuarios-repositorio.port';

/**
 * Concede uma permissão granular a um usuário -- valida contra o TETO do papel dele
 * (papel_permissoes) antes de gravar em usuario_permissoes. Um contador não consegue
 * conceder "financeiro:excluir" pro próprio OPERADOR_CONTADOR se essa permissão nunca
 * foi ligada a esse papel no catálogo (mesmo se tentar via API direto).
 */
@Injectable()
export class ConcederPermissaoUseCase {
  constructor(
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoes: PermissoesRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuarios: UsuariosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(alvo: Usuario, permissaoId: string, concedidoPorId: string): Promise<void> {
    const permissao = await this.permissoes.buscarPermissaoPorId(permissaoId);
    if (!permissao) {
      throw new NotFoundException('Permissão não encontrada');
    }

    const papelId = await this.usuarios.buscarIdPapelPorNome(alvo.papel);
    const teto = await this.permissoes.listarPermissoesDoPapel(papelId);
    if (!teto.some((p) => p.id === permissaoId)) {
      throw new ForbiddenException(`Permissão "${permissao.chave}" não está disponível pro papel ${alvo.papel}`);
    }

    if (alvo.contadorId === null && alvo.empresaId === null) {
      throw new BadRequestException('Permissão granular só se aplica a usuário vinculado a contador ou empresa');
    }

    await this.permissoes.conceder(alvo.id, permissaoId, concedidoPorId);

    await this.auditoria.registrar({
      usuarioId: concedidoPorId,
      contadorId: alvo.contadorId,
      empresaId: alvo.empresaId,
      acao: 'CONCEDER_PERMISSAO',
      recurso: `usuarios:${alvo.id}`,
      dadosNovos: { permissao: permissao.chave },
    });
  }
}
