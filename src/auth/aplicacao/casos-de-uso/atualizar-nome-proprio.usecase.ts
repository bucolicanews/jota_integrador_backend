import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { USUARIOS_REPOSITORIO, Usuario, UsuariosRepositorioPort } from '../portas/usuarios-repositorio.port';

/** Auto-serviço de perfil (`PATCH /auth/me`) -- só o próprio nome. Papel/vínculo/bloqueio continuam exclusivos das rotas administrativas (`/auth/usuarios/:id/...`), nunca editáveis pelo próprio usuário. */
@Injectable()
export class AtualizarNomeProprioUseCase {
  constructor(@Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort) {}

  async executar(usuarioId: string, nome: string): Promise<Usuario> {
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length < 2) {
      throw new BadRequestException('Nome precisa ter ao menos 2 caracteres');
    }

    await this.usuariosRepositorio.atualizarNome(usuarioId, nomeLimpo);

    const atualizado = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!atualizado) {
      throw new BadRequestException('Usuário não encontrado após atualização');
    }
    return atualizado;
  }
}
