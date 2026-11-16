import { BadRequestException, Injectable } from '@nestjs/common';
import { validarCnpj } from '../../../empresas/dominio/empresa';
import { ConsultaCnpjClient } from '../../infraestrutura/consulta-cnpj.client';

export interface DadosCnpj {
  razaoSocial: string;
  nomeFantasia: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  situacaoCadastral: string | null;
}

@Injectable()
export class ConsultarCnpjUseCase {
  constructor(private readonly client: ConsultaCnpjClient) {}

  async executar(cnpj: string): Promise<DadosCnpj> {
    const digitos = cnpj.replace(/\D/g, '');
    if (!validarCnpj(digitos)) {
      throw new BadRequestException('CNPJ inválido');
    }

    // Só os campos públicos de cadastro -- nunca repassar QSA (sócios, PII) pro frontend,
    // essas 3 telas (empresa/cliente/fornecedor) não precisam disso.
    const dados = await this.client.buscarEmpresa(digitos);
    const primeiroTelefone = dados.telefones?.[0];

    return {
      razaoSocial: dados.nome_empresarial,
      nomeFantasia: dados.nome_fantasia || null,
      cep: dados.endereco?.cep || null,
      logradouro: dados.endereco?.logradouro || null,
      numero: dados.endereco?.numero || null,
      complemento: dados.endereco?.complemento || null,
      bairro: dados.endereco?.bairro || null,
      cidade: dados.endereco?.municipio || null,
      estado: dados.endereco?.uf || null,
      telefone: primeiroTelefone ? `${primeiroTelefone.ddd}${primeiroTelefone.numero}` : null,
      situacaoCadastral: dados.situacao_cadastral?.codigo ?? null,
    };
  }
}
