import * as forge from 'node-forge';

export type TipoCertificado = 'A1' | 'A3';
export type StatusCertificado = 'ativo' | 'expirado' | 'revogado' | 'substituido';

const EXTENSOES_A1 = ['.pfx', '.p12'];

export interface ValidadeExtraidaPfx {
  validadeInicio: Date;
  validadeFim: Date;
  /** CN do titular do certificado (campo "subject") -- em e-CNPJ ICP-Brasil segue o padrão "RAZÃO SOCIAL:CNPJ" (ver `extrairCnpjDoTitular`). */
  titular: string | null;
}

/**
 * Abre o .pfx/.p12 de verdade com a senha informada e extrai a validade REAL do
 * certificado-folha -- nunca mais confiar em data digitada manualmente pelo usuário
 * (motivo do botão "Testar certificado" e do próprio cadastro: os dois passam por aqui).
 * Senha errada ou arquivo corrompido/não-PKCS12 lança erro aqui, convertido pelo
 * chamador numa mensagem clara pro usuário.
 */
export function extrairValidadeDoPfx(arquivo: Buffer, senha: string): ValidadeExtraidaPfx {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(arquivo.toString('binary')));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  } catch {
    throw new Error('Senha incorreta ou arquivo de certificado inválido/corrompido');
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  const certificado = certBags?.[0]?.cert;
  if (!certificado) {
    throw new Error('Nenhum certificado encontrado dentro do arquivo .pfx/.p12');
  }

  const titular = certificado.subject.getField('CN')?.value ?? null;

  return {
    validadeInicio: certificado.validity.notBefore,
    validadeFim: certificado.validity.notAfter,
    titular,
  };
}

/**
 * e-CNPJ ICP-Brasil (DOC-ICP-04/05) grava o CN no padrão "RAZÃO SOCIAL:14DIGITOS" --
 * confirmado testando com certificado real (ex: "LEILIANE MACIEL PAZ:55654417000160").
 * Retorna null se não houver ":" ou o trecho final não tiver exatamente 14 dígitos (ex:
 * certificado e-CPF, que carrega CPF de 11 dígitos em vez de CNPJ, ou outro formato) --
 * nesse caso não dá pra confirmar nem contestar o CNPJ, não é um erro.
 */
export function extrairCnpjDoTitular(titular: string | null): string | null {
  if (!titular) return null;
  const partes = titular.split(':');
  const ultimaParte = partes[partes.length - 1]?.replace(/\D/g, '') ?? '';
  return ultimaParte.length === 14 ? ultimaParte : null;
}

/** Compara ignorando formatação (pontos/barra/hífen) -- `empresas.cnpj` já é só dígitos, mas defensivo contra o cert vir formatado. */
export function cnpjsEquivalentes(cnpjA: string, cnpjB: string): boolean {
  return cnpjA.replace(/\D/g, '') === cnpjB.replace(/\D/g, '');
}

/**
 * A1 é arquivo (pfx/p12) -- cadastro via upload, coberto por este módulo. A3 é hardware
 * (token/smartcard): não tem arquivo pra cifrar/guardar no cofre da mesma forma, e
 * `certificados.arquivo_ref`/`senha_ref` são NOT NULL (migration 20260906000003) -- não
 * dá pra representar A3 corretamente sem decidir o desenho de integração com hardware
 * (driver/middleware do token), que não está especificado em nenhum doc do projeto ainda.
 * Rejeitar explicitamente em vez de gravar dado inventado/incoerente -- mesma cautela já
 * aplicada à mecânica de auth do Modo B em si (docs/SEGURANCA.md §1, "não assumir, validar").
 */
export function validarArquivoObrigatorio(tipo: TipoCertificado, nomeArquivo: string | null): void {
  if (tipo === 'A3') {
    throw new Error(
      'Cadastro de certificado A3 (hardware/token) ainda não é suportado -- desenho de integração pendente. Use A1.',
    );
  }
  if (!nomeArquivo) {
    throw new Error('Certificado A1 exige upload do arquivo (.pfx/.p12)');
  }
  const temExtensaoValida = EXTENSOES_A1.some((ext) => nomeArquivo.toLowerCase().endsWith(ext));
  if (!temExtensaoValida) {
    throw new Error(`Certificado A1 precisa ser .pfx ou .p12 (recebido: ${nomeArquivo})`);
  }
}

export function validarVigencia(validadeInicio: string | null, validadeFim: string): void {
  const fim = new Date(validadeFim);
  if (Number.isNaN(fim.getTime())) {
    throw new Error('validadeFim inválida');
  }
  if (validadeInicio) {
    const inicio = new Date(validadeInicio);
    if (!Number.isNaN(inicio.getTime()) && inicio > fim) {
      throw new Error('validadeInicio não pode ser depois de validadeFim');
    }
  }
  if (fim < new Date()) {
    throw new Error('Certificado já vencido -- validadeFim precisa ser uma data futura');
  }
}
