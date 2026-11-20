import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Espelha `OperacaoInput`/`ItemOperacaoInput` do serviço oficial RFB
 * (github.com/ReceitaFederal/calculadora-rtc-regime-regular). Grupos opcionais não
 * confirmados campo a campo contra o fonte (`gCompraGov`, `impostoSeletivo`,
 * `tributacaoRegular`, `gComponentesBC`, `aliquotasNominais`) ficam como registro aberto --
 * nunca inventar schema interno deles. `aliquotasNominais` é OBRIGATÓRIO a partir de
 * 2027-01-01 (proibido antes dessa data, por regra do próprio input) -- ainda não mapeado
 * em lugar nenhum deste sistema, pendência registrada, não resolvida aqui.
 */
export interface ItemOperacaoRegularInput {
  numero: number;
  ncm: string | null;
  nbs: string | null;
  /** 3 dígitos -- CST-IBS/CBS. */
  cst: string;
  /** 6 dígitos -- Código de Classificação Tributária. */
  cClassTrib: string;
  /** Obrigatória quando impostoSeletivo e gComponentesBC não informados. */
  baseCalculo: string | null;
  quantidade: string | null;
  unidade: string | null;
  impostoSeletivo?: Record<string, unknown>;
  tributacaoRegular?: Record<string, unknown>;
  gComponentesBC?: Record<string, unknown>;
  aliquotasNominais?: Record<string, unknown>;
}

export interface OperacaoRegularInput {
  id: string;
  versao: string;
  /** ISO 8601 com offset (OffsetDateTime do Java) -- ex "2027-03-15T09:50:05-03:00". */
  dhFatoGerador: string | null;
  /** Código IBGE do município. */
  municipio: number;
  uf: string;
  tpDoc: number;
  gCompraGov?: Record<string, unknown>;
  itens: ItemOperacaoRegularInput[];
}

/**
 * Resposta de `POST /calculadora/regime-geral` (`ROCDomain`) -- só o envelope confirmado
 * (`oper`/`objetos`/`total`) é tipado. `objetos`/`total` carregam dezenas de subgrupos
 * (monofasia, diferimento, crédito presumido, compra governamental...) não confirmados
 * campo a campo -- registro aberto de propósito, nunca inventar schema.
 */
export interface RocDomainOutput {
  oper: Record<string, unknown>;
  objetos: Record<string, unknown>[];
  total: Record<string, unknown> | null;
}

/**
 * Container local (sem credencial, sem TLS) -- ver docker-compose.yml e
 * docker/rtc-regime-regular/README.md pra buildar a imagem antes do primeiro uso. Nunca
 * exposto ao frontend: só este client (backend) fala com o serviço.
 */
@Injectable()
export class CalculadoraRtcRegimeRegularClient {
  constructor(private readonly config: ConfigService) {}

  async calcular(operacao: OperacaoRegularInput): Promise<RocDomainOutput> {
    // context-path /api confirmado em application-offline.yml do serviço -- sem ele dá 404.
    const resposta = await fetch(`${this.baseUrl()}/api/calculadora/regime-geral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(operacao),
    });

    if (!resposta.ok) {
      throw new InternalServerErrorException(`Falha ao consultar calculadora RTC Regime Regular (HTTP ${resposta.status})`);
    }
    return (await resposta.json()) as RocDomainOutput;
  }

  private baseUrl(): string {
    const url = this.config.get<string>('RTC_REGIME_REGULAR_URL');
    if (!url) {
      throw new InternalServerErrorException('RTC_REGIME_REGULAR_URL não configurada');
    }
    return url;
  }
}
