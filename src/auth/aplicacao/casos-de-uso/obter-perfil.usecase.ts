import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StorageAvataresService } from '../../infraestrutura/storage-avatares.service';
import {
  USUARIOS_REPOSITORIO,
  Usuario,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';

@Injectable()
export class ObterPerfilUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    private readonly storage: StorageAvataresService,
  ) {}

  async executar(usuarioId: string): Promise<Usuario> {
    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }
    // `avatarUrl` chega da base como o ref crú (path no bucket) -- resolve pra signed URL
    // aqui, nunca expor o ref direto pro frontend.
    if (usuario.avatarUrl) {
      usuario.avatarUrl = await this.storage.gerarUrlAssinada(usuario.avatarUrl);
    }
    return usuario;
  }
}
