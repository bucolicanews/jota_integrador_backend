import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TokenCnpjSerpro {
  accessToken: string;
  expiraEm: number; // epoch ms
}

/**
 * Autenticação OAuth2 da API "Consulta CNPJ" da Loja SERPRO (gateway.apiserpro.serpro.gov.br,
 * WSO2 API Manager) -- produto diferente do Conecta Gov.br (natureza jurídica da Jota não é
 * elegível ali) e diferente do Integra Contador (src/serpro, que usa host/certificado mTLS
 * próprios). Aqui a credencial (Consumer Key/Secret) é obtida uma vez via login com e-CNPJ na
 * Área do Cliente SERPRO, mas a chamada em si não usa certificado -- só Basic auth + client
 * credentials. CONFIRMADO contra o endpoint trial real em 2026-11-16 (retornou 401 "Missing
 * Credentials" do WSO2, ou seja, o endpoint existe e espera exatamente esse fluxo). Ver
 * https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cnpj/pt/quick_start/.
 */
@Injectable()
export class ConsultaCnpjAuthService {
  private cache: TokenCnpjSerpro | null = null;

  constructor(private readonly config: ConfigService) {}

  async obterToken(forcarRenovacao = false): Promise<string> {
    if (!forcarRenovacao && this.cache && this.cache.expiraEm > Date.now()) {
      return this.cache.accessToken;
    }

    const consumerKey = this.config.get<string>('SERPRO_CNPJ_CONSUMER_KEY');
    const consumerSecret = this.config.get<string>('SERPRO_CNPJ_CONSUMER_SECRET');
    if (!consumerKey || !consumerSecret) {
      throw new InternalServerErrorException(
        'Consulta CNPJ (SERPRO) não configurada (SERPRO_CNPJ_CONSUMER_KEY/SERPRO_CNPJ_CONSUMER_SECRET)',
      );
    }

    const credenciais = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const resposta = await fetch('https://gateway.apiserpro.serpro.gov.br/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credenciais}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!resposta.ok) {
      throw new InternalServerErrorException(`Falha ao autenticar na Consulta CNPJ SERPRO (HTTP ${resposta.status})`);
    }

    const json = (await resposta.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new InternalServerErrorException('Resposta de autenticação da Consulta CNPJ SERPRO sem access_token');
    }

    this.cache = {
      accessToken: json.access_token,
      // Margem de segurança de 60s antes da expiração real informada (~55min, ver doc).
      expiraEm: Date.now() + (json.expires_in ?? 3295) * 1000 - 60_000,
    };
    return this.cache.accessToken;
  }

  /** Chamado pelo client ao receber 401 -- sem endpoint de refresh, mesma lógica do SERPRO Integra Contador. */
  invalidarCache(): void {
    this.cache = null;
  }
}
