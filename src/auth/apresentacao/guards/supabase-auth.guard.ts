import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PROVEDOR_IDENTIDADE,
  ProvedorIdentidadePort,
} from '../../aplicacao/portas/provedor-identidade.port';
import {
  SESSOES_2FA_EMAIL_REPOSITORIO,
  Sessoes2faEmailRepositorioPort,
} from '../../aplicacao/portas/sessoes-2fa-email-repositorio.port';
import { CHAVE_ISENTO_MFA } from '../decorators/isento-mfa.decorator';
import { RequisicaoAutenticada } from '../tipos/requisicao-autenticada';

/**
 * Valida o JWT do Supabase Auth em toda rota protegida e popula `req.usuario` com
 * id/papel/contador_id/empresa_id -- lidos direto do app_metadata do token, sem
 * consultar o banco (docs/ARQUITETURA.md, docs/BANCO_DE_DADOS.md §1).
 *
 * Também aplica aqui (não num guard separado) o segundo fator opcional por usuário
 * (`metodo2fa`, docs/SEGURANCA.md §8, atualização 2026-11-09 -- deixou de ser
 * obrigatório fixo por escopo) -- este é o único lugar que já popula `req.usuario`/
 * decodifica o token, então é o ponto certo pra não duplicar round-trip. Rotas de
 * auto-serviço que o próprio usuário precisa pra SAIR do estado "2FA pendente" usam
 * `@IsentoMfa()` (ver 'me', 'me/2fa/...', 'logout-global').
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    @Inject(PROVEDOR_IDENTIDADE) private readonly provedorIdentidade: ProvedorIdentidadePort,
    @Inject(SESSOES_2FA_EMAIL_REPOSITORIO) private readonly sessoes2faEmail: Sessoes2faEmailRepositorioPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requisicao = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    const token = this.extrairToken(requisicao);

    if (!token) {
      throw new UnauthorizedException('Token de autenticação ausente');
    }

    const usuario = await this.provedorIdentidade.validarToken(token);
    requisicao.usuario = usuario;

    const isento = this.reflector.getAllAndOverride<boolean | undefined>(CHAVE_ISENTO_MFA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isento || usuario.metodo2fa === 'nenhum') {
      return true;
    }

    if (usuario.metodo2fa === 'totp') {
      // Preferência diz TOTP mas não há fator verificado no provedor (ex: usuário
      // desinscreveu o fator direto no app autenticador sem passar por "Nenhum" antes)
      // -- bloqueia em vez de deixar passar, estado inconsistente nunca é "sem 2FA" por
      // omissão. `@IsentoMfa()` em `me/2fa/nenhum` é a saída pra corrigir isso.
      if (!usuario.mfaVerificado) {
        throw new ForbiddenException('Seu 2FA (TOTP) está inconsistente -- acesse "Meu Perfil" para reconfigurar ou desativar.');
      }
      if (usuario.aal !== 'aal2') {
        throw new UnauthorizedException('Sessão não concluiu o desafio de 2FA -- complete o código antes de continuar');
      }
      return true;
    }

    // metodo2fa === 'email' -- Supabase não tem fator nativo de email, então a
    // verificação mora inteiramente do nosso lado (ver sessoes_2fa_email_verificadas).
    const sessaoVerificada = await this.sessoes2faEmail.estaVerificada(usuario.sessionId);
    if (!sessaoVerificada) {
      throw new UnauthorizedException('Confirme o código de verificação enviado por email antes de continuar');
    }
    return true;
  }

  private extrairToken(requisicao: RequisicaoAutenticada): string | null {
    const cabecalho = requisicao.headers.authorization;
    if (!cabecalho?.startsWith('Bearer ')) {
      return null;
    }
    return cabecalho.slice('Bearer '.length).trim() || null;
  }
}
