import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsultaCnpjAuthService } from './consulta-cnpj-auth.service';

/** Schema v2 da API "Consulta CNPJ" (Loja SERPRO) -- ver quick_start/descrição de campos em
 * apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cnpj/pt/. */
interface RespostaConsultaCnpjBasica {
  ni: string;
  nome_empresarial: string;
  nome_fantasia: string | null;
  situacao_cadastral?: { codigo: string; data: string; motivo: string };
  natureza_juridica?: { codigo: string; descricao: string };
  endereco?: {
    logradouro: string;
    numero: string;
    complemento: string;
    cep: string;
    bairro: string;
    municipio: string;
    uf: string;
  };
  telefones?: { ddd: string; numero: string }[];
}

@Injectable()
export class ConsultaCnpjClient {
  constructor(
    private readonly config: ConfigService,
    private readonly auth: ConsultaCnpjAuthService,
  ) {}

  async buscarEmpresa(cnpj: string): Promise<RespostaConsultaCnpjBasica> {
    const resposta = await this.requisitar(cnpj, await this.auth.obterToken());

    if (resposta.status === 401) {
      this.auth.invalidarCache();
      const retentativa = await this.requisitar(cnpj, await this.auth.obterToken(true));
      return this.tratarResposta(retentativa);
    }

    return this.tratarResposta(resposta);
  }

  private requisitar(cnpj: string, token: string): Promise<Response> {
    return fetch(`${this.baseUrl()}/basica/${cnpj}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  }

  private async tratarResposta(resposta: Response): Promise<RespostaConsultaCnpjBasica> {
    if (resposta.status === 404) {
      throw new NotFoundException('CNPJ não encontrado na Receita Federal');
    }
    if (!resposta.ok) {
      throw new InternalServerErrorException(`Falha ao consultar CNPJ na Consulta CNPJ SERPRO (HTTP ${resposta.status})`);
    }
    return (await resposta.json()) as RespostaConsultaCnpjBasica;
  }

  /** Trial e produção são produtos/assinaturas separados na Loja SERPRO (sufixo -trial no host). */
  private baseUrl(): string {
    const ambiente = this.config.get<string>('SERPRO_CNPJ_AMBIENTE') ?? 'trial';
    const sufixo = ambiente === 'producao' ? '' : '-trial';
    return `https://gateway.apiserpro.serpro.gov.br/consulta-cnpj-df${sufixo}/v2`;
  }
}
