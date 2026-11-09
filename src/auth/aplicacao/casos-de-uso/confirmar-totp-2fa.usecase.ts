import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../portas/provedor-identidade.port';
import { SincronizarMetodo2faUseCase } from './sincronizar-metodo-2fa.usecase';

/**
 * Chamado pelo client depois de `supabase.auth.mfa.enroll()` + `challengeAndVerify()`
 * terem terminado com sucesso -- nunca confia só no retorno do client (Zero Trust,
 * docs/SEGURANCA.md): revalida via admin API que o `factorId` é mesmo deste usuário e
 * está `verified` antes de aceitar TOTP como preferência de 2FA.
 */
@Injectable()
export class ConfirmarTotp2faUseCase {
  constructor(
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
    private readonly sincronizarMetodo2fa: SincronizarMetodo2faUseCase,
  ) {}

  async executar(usuarioId: string, factorId: string): Promise<void> {
    const verificado = await this.provedorIdentidade.fatorMfaVerificado(usuarioId, factorId);
    if (!verificado) {
      throw new ForbiddenException('Fator MFA não encontrado ou ainda não verificado para este usuário');
    }
    await this.sincronizarMetodo2fa.executar(usuarioId, 'totp');
  }
}
