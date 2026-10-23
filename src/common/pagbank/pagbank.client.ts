// Cliente HTTP pra API PagBank v4 (sandbox e produção) -- portado quase literal do
// projeto irmão serer_delivery (src/pagamentos/pagbank.client.ts), que já tem split
// confirmado funcionando em produção. Mesma estrutura, mesmos cuidados.
type PagBankCustomer = {
  name: string;
  email: string;
  tax_id: string;
  phones?: Array<{ country: string; area: string; number: string; type: 'MOBILE' | 'HOME' }>;
};

export type PagBankSplit = {
  method: 'FIXED' | 'PERCENTAGE';
  receivers: Array<{ account: { id: string }; amount: { value: number } }>;
};

interface ParametrosOrdem {
  reference_id: string;
  valor_centavos: number;
  customer: PagBankCustomer;
  itens: { name: string; quantity: number; unit_amount: number }[];
  webhook_url: string;
  splits?: PagBankSplit;
}

export class PagBankClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(token: string, sandbox: boolean) {
    this.token = token.trim();
    this.baseUrl = sandbox ? 'https://sandbox.api.pagseguro.com' : 'https://api.pagseguro.com';
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
      'x-api-version': '4.0',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const resposta = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await resposta.json()) as any;

    if (!resposta.ok) {
      const mensagem = json?.error_messages?.[0]?.description ?? json?.message ?? `HTTP ${resposta.status}`;
      throw new Error(`PagBank: ${mensagem}`);
    }

    return json as T;
  }

  /** `POST /public-keys {type:'card'}` -- chave pública (RSA) pro frontend criptografar o cartão com PagSeguro.encryptCard() ANTES de mandar pro nosso backend (nunca recebemos PAN/CVV em texto puro, ver comentário em obter-chave-publica-cartao.usecase.ts). Confirmado contra produção real em 2026-10-21. */
  async obterChavePublicaCartao(): Promise<string> {
    const resposta = await this.request<{ public_key: string }>('POST', '/public-keys', { type: 'card' });
    return resposta.public_key;
  }

  private montarPayload(params: ParametrosOrdem, charge: Record<string, any>): Record<string, any> {
    if (params.splits) charge.splits = params.splits;
    return {
      reference_id: params.reference_id,
      customer: params.customer,
      items: params.itens.map((item, i) => ({ reference_id: `ITEM_${i + 1}`, ...item })),
      notification_urls: [params.webhook_url],
      charges: [charge],
    };
  }

  /**
   * Cria ordem PIX. `splits` (opcional) divide o valor entre contador e plataforma
   * automaticamente -- vai DENTRO de charges[0].splits, nunca na raiz do pedido (a raiz
   * aceita campo desconhecido sem erro, então split mal posicionado é ignorado em
   * silêncio e 100% cai numa conta só -- bug real já corrigido no projeto de origem).
   */
  async criarOrdemPix(params: ParametrosOrdem) {
    const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const charge: Record<string, any> = {
      reference_id: `CHG_${params.reference_id}`,
      description: 'Pagamento via PIX',
      amount: { value: params.valor_centavos, currency: 'BRL' },
      payment_method: {
        type: 'PIX',
        pix: { expiration_date: expiracao },
      },
    };

    return this.request<any>('POST', '/orders', this.montarPayload(params, charge));
  }

  /**
   * Cria ordem com cartão de crédito -- `cardEncrypted` já vem criptografado do frontend
   * (PagSeguro.encryptCard(), chave pública de obterChavePublicaCartao()), número/CVV
   * nunca passam em texto puro por aqui. SEM 3DS (mesma lacuna conhecida/aceita do
   * DeliveryHub pra débito -- cartões que exigirem autenticação adicional vão ser
   * recusados pela PagBank; não implementado nesta rodada).
   */
  async criarOrdemCartao(params: ParametrosOrdem & { cardEncrypted: string; installments?: number }) {
    const charge: Record<string, any> = {
      reference_id: `CHG_${params.reference_id}`,
      description: 'Pagamento com cartão de crédito',
      amount: { value: params.valor_centavos, currency: 'BRL' },
      payment_method: {
        type: 'CREDIT_CARD',
        installments: params.installments ?? 1,
        capture: true,
        card: { encrypted: params.cardEncrypted, store: false },
      },
    };

    return this.request<any>('POST', '/orders', this.montarPayload(params, charge));
  }

  async buscarOrdem(pagbankOrderId: string) {
    return this.request<any>('GET', `/orders/${pagbankOrderId}`);
  }
}
