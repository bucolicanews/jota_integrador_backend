import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { PagBankClient } from './pagbank.client';

interface LinhaConfiguracaoPlataforma {
  pagbank_account_id: string | null;
  pagbank_sandbox: boolean;
  pagbank_split_habilitado: boolean;
}

export interface ConfiguracaoSplitPagBank {
  client: PagBankClient;
  webhookUrl: string;
  sandbox: boolean;
  splitHabilitado: boolean;
  platformAccountId: string | null;
}

/**
 * Resolve as credenciais/config do PagBank pra montar uma cobrança com split. Token da
 * plataforma SÓ em .env (nunca no banco -- mesmo tratamento que STRIPE_SECRET_KEY já
 * recebe neste projeto); conta/sandbox/kill-switch ficam em `configuracoes_plataforma`
 * (singleton, mesma tabela que já guarda a comissão de honorários).
 */
@Injectable()
export class PagbankConfigService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * @param webhookPath Segmento final da rota do webhook DESTE produto (ex: 'creditos-avulsos',
   * 'licencas-modulo', 'licencas-modulo-atacado', 'assinatura-creditos') -- precisa bater
   * exatamente com o `@Post(...)` do controller que vai receber a notificação. Obrigatório
   * em todo usecase que INICIA uma cobrança (vai dentro de `webhook_url` pro PagBank); cada
   * produto tem seu próprio controller/rota, nunca reusar o path de outro produto (já
   * aconteceu -- os 4 produtos liam uma única PAGBANK_WEBHOOK_URL fixa, então 3 deles
   * notificavam o handler errado e o pagamento nunca confirmava). Opcional só pra quem
   * NÃO cria cobrança (processamento de webhook já recebido, consulta de config) e por
   * isso nunca lê `webhookUrl` de volta.
   */
  async obterConfiguracaoSplit(webhookPath?: string): Promise<ConfiguracaoSplitPagBank> {
    const { data, error } = await this.supabase.admin
      .from('configuracoes_plataforma')
      .select('pagbank_account_id, pagbank_sandbox, pagbank_split_habilitado')
      .eq('id', 1)
      .single();

    if (error || !data) {
      throw new Error(`Falha ao carregar configuração PagBank da plataforma: ${error?.message}`);
    }
    const linha = data as LinhaConfiguracaoPlataforma;

    // Aceita PAGBANK_PLATFORM_TOKEN (nome documentado em .env.example) ou PAGBANK_TOKEN
    // (nome usado no projeto irmão serer_delivery) -- qualquer um dos dois.
    const token = this.config.get<string>('PAGBANK_PLATFORM_TOKEN') ?? this.config.get<string>('PAGBANK_TOKEN') ?? '';
    const sandbox = linha.pagbank_sandbox;
    const baseUrl = this.config.get<string>('PAGBANK_WEBHOOK_BASE_URL') ?? 'http://localhost:3002';
    const webhookUrl = `${baseUrl}/webhooks/pagbank/${webhookPath ?? 'nao-aplicavel'}`;

    return {
      client: new PagBankClient(token, sandbox),
      webhookUrl,
      sandbox,
      splitHabilitado: linha.pagbank_split_habilitado,
      platformAccountId: linha.pagbank_account_id,
    };
  }
}
