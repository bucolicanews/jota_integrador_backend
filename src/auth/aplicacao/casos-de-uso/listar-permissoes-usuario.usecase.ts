import { Inject, Injectable } from '@nestjs/common';
import { PERMISSOES_REPOSITORIO, Permissao, PermissoesRepositorioPort } from '../portas/permissoes-repositorio.port';
import { USUARIOS_REPOSITORIO, Usuario, UsuariosRepositorioPort } from '../portas/usuarios-repositorio.port';

export interface PermissoesDoUsuario {
  /** Teto -- permissões que fazem sentido pro papel desse usuário (papel_permissoes), catálogo assinalável na UI. */
  catalogoDisponivel: Permissao[];
  /** Concessões de fato (usuario_permissoes). */
  concedidas: Permissao[];
}

@Injectable()
export class ListarPermissoesUsuarioUseCase {
  constructor(
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoes: PermissoesRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuarios: UsuariosRepositorioPort,
  ) {}

  async executar(alvo: Usuario): Promise<PermissoesDoUsuario> {
    const papelId = await this.usuarios.buscarIdPapelPorNome(alvo.papel);
    const [catalogoDisponivel, concedidas] = await Promise.all([
      this.permissoes.listarPermissoesDoPapel(papelId),
      this.permissoes.listarPermissoesDoUsuario(alvo.id),
    ]);
    return { catalogoDisponivel, concedidas };
  }
}
