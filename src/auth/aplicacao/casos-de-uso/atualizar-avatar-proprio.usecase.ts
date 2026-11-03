import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StorageAvataresService } from '../../infraestrutura/storage-avatares.service';
import { USUARIOS_REPOSITORIO, Usuario, UsuariosRepositorioPort } from '../portas/usuarios-repositorio.port';

const TAMANHO_MAXIMO_BYTES = 2 * 1024 * 1024; // 2MB -- foto de perfil, não precisa de mais que isso
const TIPOS_ACEITOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface ArquivoAvatar {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** Auto-serviço (`POST /auth/me/avatar`) -- igual a AtualizarNomeProprioUseCase, mas pra foto. */
@Injectable()
export class AtualizarAvatarProprioUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    private readonly storage: StorageAvataresService,
  ) {}

  async executar(usuarioId: string, arquivo: ArquivoAvatar): Promise<Usuario> {
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      throw new BadRequestException('A imagem precisa ter no máximo 2MB');
    }
    const extensao = TIPOS_ACEITOS[arquivo.mimetype];
    if (!extensao) {
      throw new BadRequestException('Formato de imagem não aceito -- use JPG, PNG ou WEBP');
    }

    const ref = await this.storage.armazenar(usuarioId, arquivo.buffer, arquivo.mimetype, extensao);
    await this.usuariosRepositorio.atualizarAvatarRef(usuarioId, ref);

    const atualizado = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!atualizado) {
      throw new NotFoundException('Usuário não encontrado após atualização');
    }
    atualizado.avatarUrl = await this.storage.gerarUrlAssinada(ref);
    return atualizado;
  }
}
