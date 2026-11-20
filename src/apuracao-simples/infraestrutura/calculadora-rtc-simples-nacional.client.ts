import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Espelha `OperacaoSimplesInput`/`ItemSimplesInput` do serviço oficial RFB
 * (github.com/ReceitaFederal/calculadora-rtc-simples-nacional, NT 2026.005). Valores e
 * alíquotas vão como string (contrato aceita texto pra validação tolerante; ver Javadoc do
 * record original). Campos nullable do Java ficam `| null` aqui pelo mesmo motivo que lá:
 * omitidos, o item vira NAO_CALCULADO em vez de erro.
 */
export interface ItemSimplesNacionalInput {
  numero: number;
  cAtivSN: string | null;
  cClassTrib: string;
  NBS: string | null;
  NCM: string | null;
  baseCalculo: string;
  valorImpostoSeletivo: string;
  pIBSSN: string | null;
  pCBSSN: string | null;
}

export interface OperacaoSimplesNacionalInput {
  id: string;
  versao: string;
  /** YYYY-MM-DD -- todos os lookups de vigência (atividade, tabela) usam esta data. */
  data: string;
  tpDoc: string;
  CRT: string;
  tpRegimeIBSCBS: string | null;
  tpEnteGov: string | null;
  itens: ItemSimplesNacionalInput[];
}

/**
 * Resposta do endpoint clássico (`POST /calculadora/observabilidade/simples-nacional`,
 * sem `resolucaoAliquotas`). Campos de `tribCalc`/`erros`/`motivoEstado` não confirmados
 * campo a campo contra o fonte -- mantidos como registro aberto em vez de tipados, pra não
 * inventar schema. `total` e o estado do item (`estadoItem`) são os únicos confirmados
 * verbatim contra TotalSimplesDomain.java/ObjetoSimplesDomain.java.
 */
export interface ObjetoSimplesNacionalOutput {
  nObj: number;
  estadoItem: 'CALCULADO' | 'NAO_CALCULADO' | 'ERRO' | 'NAO_IMPLEMENTADO';
  motivoEstado?: Record<string, unknown>;
  tribCalc?: Record<string, unknown>;
  erros?: Record<string, unknown>[];
}

export interface TotalSimplesNacionalOutput {
  vRBSNtot: string | null;
  vBC: string | null;
  vIBSSNtot: string | null;
  vIBSSNtotPendSusp: string | null;
  vCBSSNtot: string | null;
  vCBSSNtotPendSusp: string | null;
  totalIs: string | null;
  totalTributos: string | null;
}

export interface ObservabilidadeSimplesNacionalOutput {
  oper: Record<string, unknown>;
  objetos: ObjetoSimplesNacionalOutput[];
  total: TotalSimplesNacionalOutput | null;
}

/**
 * Container local (sem credencial, sem TLS) -- ver docker-compose.yml e
 * docker/rtc-simples-nacional/README.md pra buildar a imagem antes do primeiro uso. Nunca
 * exposto ao frontend: só este client (backend) fala com o serviço.
 */
@Injectable()
export class CalculadoraRtcSimplesNacionalClient {
  constructor(private readonly config: ConfigService) {}

  async calcular(operacao: OperacaoSimplesNacionalInput): Promise<ObservabilidadeSimplesNacionalOutput> {
    const resposta = await fetch(`${this.baseUrl()}/calculadora/observabilidade/simples-nacional`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(operacao),
    });

    if (!resposta.ok) {
      throw new InternalServerErrorException(
        `Falha ao consultar calculadora RTC Simples Nacional (HTTP ${resposta.status})`,
      );
    }
    return (await resposta.json()) as ObservabilidadeSimplesNacionalOutput;
  }

  private baseUrl(): string {
    const url = this.config.get<string>('RTC_SIMPLES_NACIONAL_URL');
    if (!url) {
      throw new InternalServerErrorException('RTC_SIMPLES_NACIONAL_URL não configurada');
    }
    return url;
  }
}
