import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USUARIOS_REPOSITORIO,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';

/**
 * Reemite o link de acesso de um usuário que JÁ existe (perdeu o convite original, nunca
 * recebeu o e-mail por SMTP não configurado, etc.) -- mesmo mecanismo usado em
 * `CriarUsuarioUseCase`, só sem o passo de criação.
 */
@Injectable()
export class GerarLinkAcessoUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(usuarioId: string): Promise<{ linkAcesso: string }> {
    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const linkAcesso = await this.provedorIdentidade.gerarLinkAcesso(usuario.email);
    return { linkAcesso };
  }
}
