import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Mapeamento confirmado em internal/domain/enums/situacao.go do próprio gerador: 0=válida, 1=substituída, 2=cancelada. Qualquer outro valor o serviço trata como válida. */
export type SituacaoDanfse = 0 | 1 | 2;

export interface OpcoesGerarDanfse {
  /** Query param `stc` -- omitido quando ausente (serviço assume válida por padrão). Nunca derivado automaticamente do `situacao` da NFS-e Nacional (convenção numérica da NT não confirmada 1:1 contra este enum -- decisão explícita de quem chama, não inferência). */
  situacao?: SituacaoDanfse;
  /** Query param `canhoto` -- omitido quando ausente (default do serviço). */
  canhoto?: boolean;
}

/**
 * Container local (sem credencial, sem TLS) -- ver docker-compose.yml e
 * docker/rtc-gerador-danfse/README.md pra buildar a imagem antes do primeiro uso (este
 * repositório já tem Dockerfile oficial, diferente dos 2 calculadores). Nunca exposto ao
 * frontend: só este client (backend) fala com o serviço.
 */
@Injectable()
export class GeradorDanfseClient {
  constructor(private readonly config: ConfigService) {}

  async gerar(xmlNfse: string, opcoes: OpcoesGerarDanfse = {}): Promise<Buffer> {
    const params = new URLSearchParams();
    if (opcoes.situacao !== undefined) params.set('stc', String(opcoes.situacao));
    if (opcoes.canhoto !== undefined) params.set('canhoto', String(opcoes.canhoto));
    const query = params.toString() ? `?${params.toString()}` : '';

    const resposta = await fetch(`${this.baseUrl()}/api/danfse${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xmlNfse,
    });

    if (!resposta.ok) {
      throw new InternalServerErrorException(`Falha ao gerar DANFSe (HTTP ${resposta.status})`);
    }
    return Buffer.from(await resposta.arrayBuffer());
  }

  private baseUrl(): string {
    const url = this.config.get<string>('RTC_GERADOR_DANFSE_URL');
    if (!url) {
      throw new InternalServerErrorException('RTC_GERADOR_DANFSE_URL não configurada');
    }
    return url;
  }
}
