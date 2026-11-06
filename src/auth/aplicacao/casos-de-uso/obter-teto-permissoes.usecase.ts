import { Inject, Injectable } from '@nestjs/common';
import { Papel } from '../../dominio/papel';
import { PERMISSOES_REPOSITORIO, Permissao, PermissoesRepositorioPort } from '../portas/permissoes-repositorio.port';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../portas/usuarios-repositorio.port';

export interface TetoPermissoes {
  catalogo: Permissao[];
  selecionadas: string[];
}

/** Devolve o catálogo completo + o teto EFETIVO (override do dono, com fallback pro global) de um papel. */
@Injectable()
export class ObterTetoPermissoesUseCase {
  constructor(
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoes: PermissoesRepositorioPort,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuarios: UsuariosRepositorioPort,
  ) {}

  async executar(papel: Papel, contadorId: string | null, empresaId: string | null): Promise<TetoPermissoes> {
    const papelId = await this.usuarios.buscarIdPapelPorNome(papel);
    const [catalogo, selecionadas] = await Promise.all([
      this.permissoes.listarCatalogoPermissoes(),
      this.permissoes.obterTetoEfetivo(papelId, contadorId, empresaId),
    ]);
    return { catalogo, selecionadas: selecionadas.map((p) => p.id) };
  }
}
