import { BadRequestException, Injectable } from '@nestjs/common';
import {
  TipoCertificado,
  cnpjsEquivalentes,
  extrairCnpjDoTitular,
  extrairValidadeDoPfx,
  validarArquivoObrigatorio,
} from '../../dominio/certificado';

export interface DadosTesteCertificado {
  tipo: TipoCertificado;
  arquivo: Buffer;
  nomeArquivo: string;
  senha: string;
  /** CNPJ da empresa pra conferir se é o certificado certo -- não bloqueia aqui (só no cadastro real), só avisa. */
  cnpjEmpresa: string;
}

export interface ResultadoTesteCertificado {
  titular: string | null;
  validadeInicio: string;
  validadeFim: string;
  /** CNPJ encontrado no certificado (null se não deu pra extrair -- ex: e-CPF). */
  cnpjCertificado: string | null;
  /** true só quando os dois CNPJs foram comparáveis E são diferentes -- null/indefinido quando não deu pra confirmar. */
  cnpjDivergente: boolean;
}

/**
 * Dry-run: só abre o .pfx/.p12 com a senha informada e devolve a validade real -- nunca
 * persiste nada, nunca audita (nada foi cadastrado ainda). Usado pelo botão "Testar
 * certificado" do frontend, antes de habilitar o cadastro de verdade.
 */
@Injectable()
export class TestarCertificadoUseCase {
  executar(dados: DadosTesteCertificado): ResultadoTesteCertificado {
    try {
      validarArquivoObrigatorio(dados.tipo, dados.nomeArquivo);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    try {
      const { validadeInicio, validadeFim, titular } = extrairValidadeDoPfx(dados.arquivo, dados.senha);
      const cnpjCertificado = extrairCnpjDoTitular(titular);
      const cnpjDivergente = cnpjCertificado !== null && !cnpjsEquivalentes(cnpjCertificado, dados.cnpjEmpresa);
      return {
        titular,
        validadeInicio: validadeInicio.toISOString(),
        validadeFim: validadeFim.toISOString(),
        cnpjCertificado,
        cnpjDivergente,
      };
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }
  }
}
