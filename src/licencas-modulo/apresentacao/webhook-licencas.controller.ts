import { BadRequestException, Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProcessarWebhookStripeLicencaUseCase } from '../aplicacao/casos-de-uso/processar-webhook-stripe-licenca.usecase';

/** SEM SupabaseAuthGuard -- quem chama é o Stripe. Path separado de /webhooks/stripe/assinaturas e /honorarios -- segredo e tratamento de evento completamente diferentes. */
@Controller('webhooks/stripe')
export class WebhookLicencasController {
  constructor(private readonly processarWebhook: ProcessarWebhookStripeLicencaUseCase) {}

  @Post('licencas-modulo')
  @HttpCode(200)
  async receber(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') assinaturaHeader: string | undefined): Promise<{ recebido: true }> {
    if (!req.rawBody || !assinaturaHeader) {
      throw new BadRequestException('Requisição sem body bruto ou header stripe-signature');
    }
    try {
      await this.processarWebhook.executar(req.rawBody, assinaturaHeader);
    } catch (erro) {
      throw new BadRequestException(`Webhook inválido: ${(erro as Error).message}`);
    }
    return { recebido: true };
  }
}
