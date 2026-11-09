import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Metodo2FA,
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';
import {
  USUARIOS_REPOSITORIO,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';

/**
 * Grava a nova preferência de 2FA e ressincroniza o app_metadata do provedor --
 * compartilhado pelos 3 fluxos que mudam `metodo_2fa` (confirmar TOTP, confirmar
 * email, voltar pra "nenhum"), pra nenhum deles arriscar sobrescrever papel/escopo/
 * vínculo atuais por engano (sincronizarClaims substitui o app_metadata inteiro).
 */
@Injectable()
export class SincronizarMetodo2faUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(usuarioId: string, novoMetodo: Metodo2FA): Promise<void> {
    const [usuario, infoPapel] = await Promise.all([
      this.usuariosRepositorio.buscarPorId(usuarioId),
      this.usuariosRepositorio.buscarInfoPapelDoUsuario(usuarioId),
    ]);
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.usuariosRepositorio.atualizarMetodo2fa(usuarioId, novoMetodo);
    await this.provedorIdentidade.sincronizarClaims(usuarioId, {
      papel: usuario.papel,
      escopo: infoPapel.escopo,
      nuncaRestringe: infoPapel.nuncaRestringe,
      contadorId: usuario.contadorId,
      empresaId: usuario.empresaId,
      metodo2fa: novoMetodo,
    });
  }
}
