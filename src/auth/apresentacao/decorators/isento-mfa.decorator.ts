import { SetMetadata } from '@nestjs/common';

export const CHAVE_ISENTO_MFA = 'isento_mfa';

/**
 * Marca uma rota como isenta da checagem de MFA obrigatório (SupabaseAuthGuard,
 * ver `exigeMfa()` em dominio/papel.ts). Só deve ir nas rotas que o próprio fluxo de
 * configuração/leitura de perfil precisa pra alguém de papel de plataforma conseguir
 * SAIR do estado "MFA pendente" (ver 'me', 'me/mfa/...', 'logout-global') -- nunca numa
 * rota de negócio normal, senão vira brecha pra todo o resto da checagem.
 */
export const IsentoMfa = () => SetMetadata(CHAVE_ISENTO_MFA, true);
