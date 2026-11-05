import { validarCpf } from '../../contadores/dominio/contador';

export type ModoAcessoSerpro = 'procuracao' | 'certificado_proprio';
export type StatusEmpresa = 'ativo' | 'inativo';

// cliente = empresa-cliente de verdade (padrão). interna_contador/interna_plataforma =
// contabilidade do próprio contador/da própria Jota (Fase de licenciamento de módulos) --
// nunca aparecem em carteira/marketplace, sempre liberadas do módulo de licenciamento.
export type TipoEmpresa = 'cliente' | 'interna_contador' | 'interna_plataforma';

// fisica só é permitido quando tipo='interna_contador' (contador autônomo que atua com
// CPF+CRC, sem CNPJ -- empresa-cliente de verdade é sempre jurídica, precisa de CNPJ
// pra consulta SERPRO). Regra também reforçada por CHECK no banco (ver migration
// 20261103000003_empresa_pessoa_fisica.sql).
export type TipoPessoaEmpresa = 'fisica' | 'juridica';

// Nomenclatura de regime tributário alinhada com os serviços do SERPRO/Integra Contador
// (MEI tem serviços próprios -- CCMEI/PGMEI -- separados do Simples Nacional "regular" --
// PGDAS-D/DEFIS -- por isso não é só um sub-caso do mesmo valor).
export type RegimeTributario = 'simples_nacional' | 'mei' | 'lucro_presumido' | 'lucro_real' | 'lucro_arbitrado';
export const REGIMES_TRIBUTARIOS: RegimeTributario[] = [
  'simples_nacional',
  'mei',
  'lucro_presumido',
  'lucro_real',
  'lucro_arbitrado',
];

/**
 * Validação de CNPJ (dígitos verificadores, algoritmo oficial da Receita Federal) --
 * regra de negócio pura, sem depender de banco/framework. Nunca confiar em CNPJ vindo
 * do frontend sem essa checagem (Zero Trust, docs/SEGURANCA.md).
 */
export function validarCnpj(cnpj: string): boolean {
  const digitos = cnpj.replace(/\D/g, '');

  if (digitos.length !== 14) {
    return false;
  }
  if (/^(\d)\1{13}$/.test(digitos)) {
    return false; // todos os dígitos iguais -- nunca um CNPJ válido, embora passe no checksum
  }

  const calcularDigitoVerificador = (base: string, pesos: number[]): number => {
    const soma = base
      .split('')
      .reduce((acumulado, digito, indice) => acumulado + Number(digito) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesosPrimeiroDigito = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosSegundoDigito = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const base = digitos.slice(0, 12);
  const primeiroDigito = calcularDigitoVerificador(base, pesosPrimeiroDigito);
  const segundoDigito = calcularDigitoVerificador(base + primeiroDigito, pesosSegundoDigito);

  return digitos === `${base}${primeiroDigito}${segundoDigito}`;
}

/**
 * `empresas.cnpj` guarda CPF quando tipoPessoa='fisica' (contador autônomo, sem CNPJ) --
 * mesma coluna, dígito verificador trocado conforme o tipo. `validarCpf` importado de
 * contador.ts em vez de duplicado (mesmo algoritmo, já usado lá pra `contadores.cnpj_cpf`).
 */
export function validarDocumentoEmpresa(documento: string, tipoPessoa: TipoPessoaEmpresa): boolean {
  return tipoPessoa === 'fisica' ? validarCpf(documento) : validarCnpj(documento);
}
