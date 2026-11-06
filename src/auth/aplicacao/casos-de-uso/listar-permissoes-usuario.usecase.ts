import { Inject, Injectable } from '@nestjs/common';
import { PERMISSOES_REPOSITORIO, Permissao, PermissoesRepositorioPort } from '../portas/permissoes-repositorio.port';
import { USUARIOS_REPOSITORIO, Usuario, UsuariosRepositorioPort } from '../portas/usuarios-repositorio.port';

export interface PermissoesDoUsuario {
  /** Teto EFETIVO -- override do dono (papel_permissoes_dono) se existir, senão o global (papel_permissoes); catálogo assinalável na UI. */
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
      this.permissoes.obterTetoEfetivo(papelId, alvo.contadorId, alvo.empresaId),
      this.permissoes.listarPermissoesDoUsuario(alvo.id),
    ]);
    return { catalogoDisponivel, concedidas };
  }
}
