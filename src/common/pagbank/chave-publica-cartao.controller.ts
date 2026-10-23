import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/apresentacao/guards/supabase-auth.guard';
import { PagbankConfigService } from './pagbank-config.service';

/**
 * Chave pública (RSA) da PagBank pro frontend criptografar o cartão no navegador
 * (PagSeguro.encryptCard()) ANTES de mandar pro nosso backend -- nunca recebemos
 * número/CVV em texto puro (ver docs/SEGURANCA.md e comentário em pagbank.client.ts).
 * Não é dado sensível (é literalmente pública), qualquer usuário autenticado pode pedir --
 * sem posse de empresa/contador aqui, é igual pra todo mundo.
 */
@Controller('pagbank')
@UseGuards(SupabaseAuthGuard)
export class ChavePublicaCartaoController {
  constructor(private readonly pagbankConfig: PagbankConfigService) {}

  @Get('chave-publica-cartao')
  async chavePublica(): Promise<{ publicKey: string }> {
    const { client } = await this.pagbankConfig.obterConfiguracaoSplit();
    const publicKey = await client.obterChavePublicaCartao();
    return { publicKey };
  }
}
