/**
 * `sessoes_2fa_email_verificadas` -- uma linha por sessão (session_id do JWT) que já
 * confirmou o código de email nesta sessão. Só existe porque Supabase não tem fator MFA
 * nativo de email (só TOTP/phone/webauthn) -- TOTP usa o `aal` da própria sessão, email
 * precisa de controle próprio (ver docs/SEGURANCA.md §8, atualização 2026-11-09).
 */
export interface Sessoes2faEmailRepositorioPort {
  estaVerificada(sessionId: string): Promise<boolean>;
  marcarVerificada(sessionId: string, usuarioId: string, duracaoMs: number): Promise<void>;
}

export const SESSOES_2FA_EMAIL_REPOSITORIO = Symbol('SESSOES_2FA_EMAIL_REPOSITORIO');
