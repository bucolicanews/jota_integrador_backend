import { Inject, Injectable } from '@nestjs/common';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';

/**
 * Admin-on-behalf define a senha de login de outro usuário (`PATCH /auth/usuarios/:id/senha`)
 * -- autoridade checada no controller via `exigirAutoridadeSobre`, mesma regra de
 * bloquear/editar e-mail. O próprio usuário troca a própria senha direto no client
 * (`supabase.auth.updateUser`), nunca passa por aqui -- por isso não existe `/me/senha`.
 */
@Injectable()
export class AtualizarSenhaUsuarioUseCase {
  constructor(
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
  ) {}

  async executar(usuarioId: string, novaSenha: string): Promise<void> {
    await this.provedorIdentidade.atualizarSenha(usuarioId, novaSenha);
  }
}
