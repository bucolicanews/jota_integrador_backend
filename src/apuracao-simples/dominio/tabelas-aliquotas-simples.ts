import { AnexoSimplesNacional } from './catalogo-anexos-simples';

interface FaixaAliquota {
  ate: number;
  aliquotaNominal: number;
  valorADeduzir: number;
}

/**
 * Tabelas dos 5 Anexos da LC 123/2006 (alterada pela LC 155/2016, em vigor desde
 * 01/01/2018) -- 6 faixas cada, por RBT12. REVISAR CONTRA O TEXTO OFICIAL VIGENTE antes de
 * usar pra uma declaração real (a tabela pode ter sido alterada por lei posterior, ou
 * substituída pela transição da reforma tributária -- CBS/IBS, ver docs da Fase 3-4 do
 * plano). Infinity na última faixa é só pra não deixar receita acima do limite sem faixa
 * -- empresa que ultrapassa R$ 4,8MM sai do Simples, mas o cálculo não trava por isso.
 */
const TABELAS: Record<AnexoSimplesNacional, FaixaAliquota[]> = {
  I: [
    { ate: 180_000, aliquotaNominal: 0.04, valorADeduzir: 0 },
    { ate: 360_000, aliquotaNominal: 0.073, valorADeduzir: 5_940 },
    { ate: 720_000, aliquotaNominal: 0.095, valorADeduzir: 13_860 },
    { ate: 1_800_000, aliquotaNominal: 0.107, valorADeduzir: 22_500 },
    { ate: 3_600_000, aliquotaNominal: 0.143, valorADeduzir: 87_300 },
    { ate: Infinity, aliquotaNominal: 0.19, valorADeduzir: 378_000 },
  ],
  II: [
    { ate: 180_000, aliquotaNominal: 0.045, valorADeduzir: 0 },
    { ate: 360_000, aliquotaNominal: 0.078, valorADeduzir: 5_940 },
    { ate: 720_000, aliquotaNominal: 0.1, valorADeduzir: 13_860 },
    { ate: 1_800_000, aliquotaNominal: 0.112, valorADeduzir: 22_500 },
    { ate: 3_600_000, aliquotaNominal: 0.147, valorADeduzir: 85_500 },
    { ate: Infinity, aliquotaNominal: 0.3, valorADeduzir: 720_000 },
  ],
  III: [
    { ate: 180_000, aliquotaNominal: 0.06, valorADeduzir: 0 },
    { ate: 360_000, aliquotaNominal: 0.112, valorADeduzir: 9_360 },
    { ate: 720_000, aliquotaNominal: 0.135, valorADeduzir: 17_640 },
    { ate: 1_800_000, aliquotaNominal: 0.16, valorADeduzir: 35_640 },
    { ate: 3_600_000, aliquotaNominal: 0.21, valorADeduzir: 125_640 },
    { ate: Infinity, aliquotaNominal: 0.33, valorADeduzir: 648_000 },
  ],
  IV: [
    { ate: 180_000, aliquotaNominal: 0.045, valorADeduzir: 0 },
    { ate: 360_000, aliquotaNominal: 0.09, valorADeduzir: 8_100 },
    { ate: 720_000, aliquotaNominal: 0.102, valorADeduzir: 12_420 },
    { ate: 1_800_000, aliquotaNominal: 0.14, valorADeduzir: 39_780 },
    { ate: 3_600_000, aliquotaNominal: 0.22, valorADeduzir: 183_780 },
    { ate: Infinity, aliquotaNominal: 0.33, valorADeduzir: 828_000 },
  ],
  V: [
    { ate: 180_000, aliquotaNominal: 0.155, valorADeduzir: 0 },
    { ate: 360_000, aliquotaNominal: 0.18, valorADeduzir: 4_500 },
    { ate: 720_000, aliquotaNominal: 0.195, valorADeduzir: 9_900 },
    { ate: 1_800_000, aliquotaNominal: 0.205, valorADeduzir: 17_100 },
    { ate: 3_600_000, aliquotaNominal: 0.23, valorADeduzir: 62_100 },
    { ate: Infinity, aliquotaNominal: 0.305, valorADeduzir: 540_000 },
  ],
};

export interface ResultadoAliquotaEfetiva {
  anexo: AnexoSimplesNacional;
  rbt12: number;
  aliquotaNominal: number;
  valorADeduzir: number;
  /** ((RBT12 × Alíq. Nominal) − Valor a Deduzir) ÷ RBT12 -- 0 quando RBT12=0 (sem receita, sem alíquota a aplicar). */
  aliquotaEfetiva: number;
}

/** Alíquota efetiva pra um Anexo a partir do RBT12 -- fórmula oficial da LC 123/2006 Art. 18 §1º-A. */
export function calcularAliquotaEfetiva(anexo: AnexoSimplesNacional, rbt12: number): ResultadoAliquotaEfetiva {
  const faixas = TABELAS[anexo];
  const faixa = faixas.find((f) => rbt12 <= f.ate) ?? faixas[faixas.length - 1];
  const aliquotaEfetiva = rbt12 > 0 ? (rbt12 * faixa.aliquotaNominal - faixa.valorADeduzir) / rbt12 : 0;
  return {
    anexo,
    rbt12,
    aliquotaNominal: faixa.aliquotaNominal,
    valorADeduzir: faixa.valorADeduzir,
    aliquotaEfetiva: Math.max(0, aliquotaEfetiva),
  };
}
