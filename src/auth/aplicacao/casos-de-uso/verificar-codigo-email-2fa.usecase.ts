import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  SESSOES_2FA_EMAIL_REPOSITORIO,
  Sessoes2faEmailRepositorioPort,
} from '../portas/sessoes-2fa-email-repositorio.port';
import {
  USUARIOS_REPOSITORIO,
  UsuariosRepositorioPort,
} from '../portas/usuarios-repositorio.port';
import { SincronizarMetodo2faUseCase } from './sincronizar-metodo-2fa.usecase';

// Sessão fica "verificada" por 12h (não é por request) -- combina com a janela normal
// de sessão do Supabase; cada LOGIN novo tem session_id novo, então pedir o código de
// novo num login novo acontece naturalmente, sem precisar expirar isto à força.
const DURACAO_SESSAO_VERIFICADA_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class VerificarCodigoEmail2faUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    @Inject(SESSOES_2FA_EMAIL_REPOSITORIO) private readonly sessoes2faEmail: Sessoes2faEmailRepositorioPort,
    private readonly sincronizarMetodo2fa: SincronizarMetodo2faUseCase,
  ) {}

  async executar(usuarioId: string, sessionId: string, codigo: string): Promise<void> {
    const resultado = await this.usuariosRepositorio.verificarCodigoEmail2fa(usuarioId, codigo);

    if (resultado === 'muitas_tentativas') {
      throw new ForbiddenException('Muitas tentativas erradas -- solicite um novo código.');
    }
    if (resultado === 'expirado') {
      throw new BadRequestException('Código expirado -- solicite um novo.');
    }
    if (resultado === 'invalido') {
      throw new BadRequestException('Código inválido.');
    }

    // Idempotente se já era 'email' -- primeiro cadastro E desafio de login passam
    // pelo mesmo caminho (ver EnviarCodigoEmail2faUseCase).
    await this.sincronizarMetodo2fa.executar(usuarioId, 'email');
    await this.sessoes2faEmail.marcarVerificada(sessionId, usuarioId, DURACAO_SESSAO_VERIFICADA_MS);
  }
}
