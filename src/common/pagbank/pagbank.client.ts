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

  /**
   * Cria ordem PIX. `splits` (opcional) divide o valor entre contador e plataforma
   * automaticamente -- vai DENTRO de charges[0].splits, nunca na raiz do pedido (a raiz
   * aceita campo desconhecido sem erro, então split mal posicionado é ignorado em
   * silêncio e 100% cai numa conta só -- bug real já corrigido no projeto de origem).
   */
  async criarOrdemPix(params: {
    reference_id: string;
    valor_centavos: number;
    customer: PagBankCustomer;
    itens: { name: string; quantity: number; unit_amount: number }[];
    webhook_url: string;
    splits?: PagBankSplit;
  }) {
    const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const charge: Record<string, any> = {
      reference_id: `CHG_${params.reference_id}`,
      description: 'Ativação de pacote de módulos',
      amount: { value: params.valor_centavos, currency: 'BRL' },
      payment_method: {
        type: 'PIX',
        pix: { expiration_date: expiracao },
      },
    };
    if (params.splits) charge.splits = params.splits;

    const payload: Record<string, any> = {
      reference_id: params.reference_id,
      customer: params.customer,
      items: params.itens.map((item, i) => ({ reference_id: `ITEM_${i + 1}`, ...item })),
      notification_urls: [params.webhook_url],
      charges: [charge],
    };

    return this.request<any>('POST', '/orders', payload);
  }

  async buscarOrdem(pagbankOrderId: string) {
    return this.request<any>('GET', `/orders/${pagbankOrderId}`);
  }
}
