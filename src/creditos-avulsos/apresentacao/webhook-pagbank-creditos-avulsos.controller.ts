import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ProcessarWebhookCreditoAvulsoUseCase } from '../aplicacao/casos-de-uso/processar-webhook-credito-avulso.usecase';

/**
 * SEM SupabaseAuthGuard -- quem chama é a PagBank (mesmo motivo de
 * WebhookPagbankCreditosController em assinaturas/: PagBank não assina notificações, a
 * segurança real está no usecase, que sempre reconsulta a ordem via API antes de agir).
 */
@Controller('webhooks/pagbank')
export class WebhookPagbankCreditosAvulsosController {
  constructor(private readonly processarWebhook: ProcessarWebhookCreditoAvulsoUseCase) {}

  @Post('creditos-avulsos')
  @HttpCode(200)
  async receber(@Body() corpo: any): Promise<{ recebido: true }> {
    await this.processarWebhook.executar(corpo);
    return { recebido: true };
  }
}
