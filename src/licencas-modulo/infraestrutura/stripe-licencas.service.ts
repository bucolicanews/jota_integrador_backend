import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface DadosCheckoutLicenca {
  customerId: string;
  contadorId: string;
  pacoteId: string;
  pacoteNome: string;
  precoReais: number;
  periodicidade: 'mensal' | 'anual';
  successUrl: string;
  cancelUrl: string;
}

/**
 * Licenciamento de módulos (contador -> Jota, atacado) -- mesmo princípio de
 * StripeAssinaturasService (sem Connect, price_data inline, secret só em env), mas
 * webhook e produto completamente separados -- créditos SERPRO e licença de módulo são
 * dois produtos distintos vendidos ao contador, nunca mesclar.
 */
@Injectable()
export class StripeLicencasService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.stripe = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'));
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET_LICENCAS');
  }

  async obterOuCriarCustomer(contadorId: string, email: string, nome: string): Promise<string> {
    const customer = await this.stripe.customers.create({ email, name: nome, metadata: { contador_id: contadorId } });
    return customer.id;
  }

  async criarCheckoutSession(dados: DadosCheckoutLicenca): Promise<{ url: string }> {
    const metadata = { contador_id: dados.contadorId, pacote_id: dados.pacoteId };

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: dados.customerId,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: { name: `Licença: ${dados.pacoteNome}` },
            unit_amount: Math.round(dados.precoReais * 100),
            recurring: { interval: dados.periodicidade === 'anual' ? 'year' : 'month' },
          },
          quantity: 1,
        },
      ],
      metadata,
      subscription_data: { metadata },
      success_url: dados.successUrl,
      cancel_url: dados.cancelUrl,
    });

    if (!session.url) {
      throw new Error('Stripe não retornou URL de checkout');
    }
    return { url: session.url };
  }

  async obterMetadataSubscription(stripeSubscriptionId: string): Promise<{ contadorId: string; pacoteId: string } | null> {
    const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    const contadorId = subscription.metadata?.contador_id;
    const pacoteId = subscription.metadata?.pacote_id;
    if (!contadorId || !pacoteId) return null;
    return { contadorId, pacoteId };
  }

  construirEvento(payloadBruto: Buffer, assinaturaHeader: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payloadBruto, assinaturaHeader, this.webhookSecret);
  }
}
