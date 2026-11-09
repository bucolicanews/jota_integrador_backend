import { Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  USUARIOS_REPOSITORIO,
  UsuariosRepositorioPort,
} from '../../auth/aplicacao/portas/usuarios-repositorio.port';

export interface ResultadoVerificacaoSenha {
  /** Ausente = Supabase segue o login normalmente. Presente = Supabase recusa o login com esta mensagem, mesmo se a senha estava certa. */
  decision?: 'reject';
  message?: string;
}

/**
 * Chamado pelo hook "Password Verification Attempt" do Supabase (controller) a cada
 * tentativa de login -- é o ÚNICO lugar que sabe "fulano tentou logar e a senha estava
 * certa/errada", já que o login em si nunca passa pelo NestJS (docs/SEGURANCA.md §8).
 * Faz dois trabalhos que o DeliveryHub faz dentro do próprio AuthLoginService (lá dá pra
 * fazer direto porque o login passa pelo backend; aqui tem que ser via hook):
 * 1. Grava em `logs_auditoria` -- visibilidade que hoje só existe no dashboard do GoTrue.
 * 2. Lockout automático (5 tentativas/5min) -- `usuarios.bloqueio_automatico_ate`.
 */
@Injectable()
export class ProcessarTentativaLoginUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(usuarioId: string, senhaValida: boolean): Promise<ResultadoVerificacaoSenha> {
    const usuario = await this.usuariosRepositorio.buscarPorId(usuarioId);

    await this.auditoria.registrar({
      usuarioId,
      contadorId: usuario?.contadorId ?? null,
      empresaId: usuario?.empresaId ?? null,
      acao: senhaValida ? 'LOGIN_SENHA_VALIDA' : 'LOGIN_SENHA_INVALIDA',
      recurso: 'auth.sessao',
    });

    // Usuário sem perfil em `usuarios` (identidade órfã no provedor) -- nada a fazer
    // além de já ter auditado acima; não há lockout nem conta pra incrementar.
    if (!usuario) return {};

    const agoraEmMs = Date.now();
    if (usuario.bloqueioAutomaticoAte && new Date(usuario.bloqueioAutomaticoAte).getTime() > agoraEmMs) {
      // Lockout de uma tentativa anterior ainda ativo -- recusa mesmo se a senha DESTA
      // tentativa está certa (mesmo comportamento do AuthLoginService do DeliveryHub:
      // checa o bloqueio antes de aceitar a senha).
      return { decision: 'reject', message: 'Muitas tentativas com senha errada. Aguarde para tentar de novo.' };
    }

    const novoBloqueioAte = await this.usuariosRepositorio.registrarTentativaLogin(usuarioId, senhaValida);
    if (novoBloqueioAte) {
      return { decision: 'reject', message: 'Muitas tentativas com senha errada. Conta bloqueada temporariamente.' };
    }
    return {};
  }
}
