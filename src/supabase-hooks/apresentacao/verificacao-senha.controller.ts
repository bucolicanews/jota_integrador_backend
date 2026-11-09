import { Controller, HttpCode, Post, Req, UnauthorizedException, RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ProcessarTentativaLoginUseCase, ResultadoVerificacaoSenha } from '../aplicacao/processar-tentativa-login.usecase';
import { verificarAssinaturaWebhookSupabase } from '../infraestrutura/verificador-assinatura-webhook';

/**
 * Auth Hook "Password Verification Attempt" do Supabase (configurado no painel em
 * produção; local via supabase/config.toml `[auth.hook.password_verification_attempt]`)
 * -- dispara a CADA tentativa de login, com o resultado da verificação de senha que o
 * próprio GoTrue já fez. Não tem `@UseGuards(SupabaseAuthGuard...)`: quem chama é o
 * Supabase, não um usuário logado -- autenticidade vem só da assinatura HMAC (ver
 * verificador-assinatura-webhook.ts), nunca de um JWT.
 */
@Controller('supabase-hooks')
export class VerificacaoSenhaController {
  constructor(
    private readonly config: ConfigService,
    private readonly processarTentativaLogin: ProcessarTentativaLoginUseCase,
  ) {}

  // GoTrue exige HTTP 200 exato da resposta do hook -- 201 (default do NestJS pra
  // @Post()) já conta como "Unexpected status code returned from hook", e GoTrue
  // trata isso como falha do hook (fail-closed: bloqueia o login mesmo com senha certa).
  @Post('verificacao-senha')
  @HttpCode(200)
  async verificacaoSenha(@Req() requisicao: RawBodyRequest<Request>): Promise<ResultadoVerificacaoSenha> {
    const corpoCru = requisicao.rawBody;
    if (!corpoCru) {
      throw new UnauthorizedException('Corpo da requisição ausente');
    }

    const assinaturaValida = verificarAssinaturaWebhookSupabase(
      corpoCru,
      requisicao.headers as Record<string, string>,
      this.config.getOrThrow<string>('SUPABASE_AUTH_HOOK_SECRET'),
    );
    if (!assinaturaValida) {
      throw new UnauthorizedException('Assinatura do webhook inválida');
    }

    const corpo = JSON.parse(corpoCru.toString('utf8')) as { user_id: string; valid: boolean };
    return this.processarTentativaLogin.executar(corpo.user_id, corpo.valid);
  }
}
