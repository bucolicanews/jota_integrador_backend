import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Email2faService } from '../../../common/email/email-2fa.service';
import {
  USUARIOS_REPOSITORIO,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';

const TTL_CODIGO_EMAIL_2FA_MS = 10 * 60 * 1000;

/**
 * Gera e envia um código de 6 dígitos pro email de LOGIN do usuário -- usado tanto no
 * primeiro cadastro do método 'email' quanto no desafio de cada login (mesmo endpoint,
 * ver VerificarCodigoEmail2faUseCase pra confirmação -- diferença de contexto nenhuma
 * pro servidor, o que muda é se o `metodo_2fa` já era 'email' antes ou não).
 */
@Injectable()
export class EnviarCodigoEmail2faUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    private readonly email2fa: Email2faService,
  ) {}

  async executar(usuarioId: string): Promise<void> {
    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    await this.usuariosRepositorio.salvarCodigoEmail2fa(usuarioId, codigo, TTL_CODIGO_EMAIL_2FA_MS);
    await this.email2fa.enviarCodigo(usuario.email, codigo);
  }
}
