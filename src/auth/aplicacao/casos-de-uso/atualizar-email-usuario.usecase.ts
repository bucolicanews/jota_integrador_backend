import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';
import {
  USUARIOS_REPOSITORIO,
  Usuario,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';

/**
 * Troca o e-mail de login de um usuário -- usada tanto pelo auto-serviço (`PATCH /auth/me/email`,
 * qualquer papel troca o próprio) quanto pela rota administrativa (`PATCH /auth/usuarios/:id/email`,
 * autoridade checada no controller via `exigirAutoridadeSobre`). Mesma checagem de unicidade de
 * `CriarUsuarioUseCase` -- dois perfis nunca compartilham e-mail de login.
 */
@Injectable()
export class AtualizarEmailUsuarioUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(usuarioId: string, novoEmail: string): Promise<Usuario> {
    const emailNormalizado = novoEmail.trim().toLowerCase();

    const existente = await this.usuariosRepositorio.buscarPorEmail(emailNormalizado);
    if (existente && existente.id !== usuarioId) {
      throw new ConflictException(`O e-mail ${emailNormalizado} já está em uso por outro usuário`);
    }

    // Provedor primeiro (mesma ordem de CriarUsuarioUseCase) -- se falhar aqui (e-mail já
    // usado por uma identidade órfã no provedor, por exemplo), não sobra perfil dessincronizado.
    await this.provedorIdentidade.atualizarEmail(usuarioId, emailNormalizado);
    await this.usuariosRepositorio.atualizarEmail(usuarioId, emailNormalizado);

    const atualizado = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!atualizado) {
      throw new BadRequestException('Usuário não encontrado após atualização');
    }
    return atualizado;
  }
}
