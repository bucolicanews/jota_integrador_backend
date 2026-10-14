import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ProcessarWebhookPagbankLicencaUseCase } from '../aplicacao/casos-de-uso/processar-webhook-pagbank-licenca.usecase';

/**
 * SEM SupabaseAuthGuard -- quem chama é a PagBank. PagBank não assina notificações (ao
 * contrário do Stripe), então não há header de assinatura pra validar aqui -- a
 * segurança real está no usecase, que sempre reconsulta a ordem via API antes de agir.
 */
@Controller('webhooks/pagbank')
export class WebhookPagbankLicencasController {
  constructor(private readonly processarWebhook: ProcessarWebhookPagbankLicencaUseCase) {}

  @Post('licencas-modulo')
  @HttpCode(200)
  async receber(@Body() corpo: any): Promise<{ recebido: true }> {
    await this.processarWebhook.executar(corpo);
    return { recebido: true };
  }
}
