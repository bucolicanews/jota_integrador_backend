import { AnexoSimplesNacional } from './catalogo-anexos-simples';

export interface FaixaPartilha {
  irpj: number;
  csll: number;
  cofins: number;
  pis: number;
  /** Ausente no Anexo IV -- CPP recolhida por fora do Simples pras atividades desse Anexo. */
  cpp?: number;
  /** Só Anexo II (indústria). */
  ipi?: number;
  /** Ausente na faixa 6 de todo Anexo -- acima do sublimite, ICMS/ISS saem do DAS e passam a ser recolhidos por fora. */
  icms?: number;
  iss?: number;
}

/** Mesmos limites de RBT12 de `tabelas-aliquotas-simples.ts` -- duplicado de propósito (tabela pequena, independente, mesmo espírito já usado em outras duplicações pontuais deste módulo) pra não criar acoplamento entre os dois arquivos de dado estático. */
const LIMITES_FAIXA = [180_000, 360_000, 720_000, 1_800_000, 3_600_000, Infinity];

/**
 * Percentual de cada tributo dentro do DAS, por Anexo/faixa -- Resolução CGSN 140/2018
 * (Anexos I-V). Pesquisado e cross-checado contra 2 fontes independentes (lefisc.com.br,
 * 1ª linha do Anexo I batida contra LegisWeb -- exata). REVISAR CONTRA O TEXTO OFICIAL
 * VIGENTE antes de usar pra uma declaração real, mesma disciplina já aplicada em
 * `tabelas-aliquotas-simples.ts`. Soma de cada linha = 100% -- validado por teste
 * unitário (ver `tabelas-partilha-simples.spec.ts`), rede de segurança contra erro de
 * digitação nesta tabela inteiramente nova.
 */
const PARTILHA: Record<AnexoSimplesNacional, FaixaPartilha[]> = {
  I: [
    { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.415, icms: 0.34 },
    { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.415, icms: 0.34 },
    { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.42, icms: 0.335 },
    { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.42, icms: 0.335 },
    { irpj: 0.055, csll: 0.035, cofins: 0.1274, pis: 0.0276, cpp: 0.42, icms: 0.335 },
    { irpj: 0.135, csll: 0.1, cofins: 0.2827, pis: 0.0613, cpp: 0.421 },
  ],
  II: [
    { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.375, ipi: 0.075, icms: 0.32 },
    { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.375, ipi: 0.075, icms: 0.32 },
    { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.375, ipi: 0.075, icms: 0.32 },
    { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.375, ipi: 0.075, icms: 0.32 },
    { irpj: 0.055, csll: 0.035, cofins: 0.1151, pis: 0.0249, cpp: 0.375, ipi: 0.075, icms: 0.32 },
    { irpj: 0.085, csll: 0.075, cofins: 0.2096, pis: 0.0454, cpp: 0.235, ipi: 0.35 },
  ],
  III: [
    { irpj: 0.04, csll: 0.035, cofins: 0.1282, pis: 0.0278, cpp: 0.434, iss: 0.335 },
    { irpj: 0.04, csll: 0.035, cofins: 0.1405, pis: 0.0305, cpp: 0.434, iss: 0.32 },
    { irpj: 0.04, csll: 0.035, cofins: 0.1364, pis: 0.0296, cpp: 0.434, iss: 0.325 },
    { irpj: 0.04, csll: 0.035, cofins: 0.1364, pis: 0.0296, cpp: 0.434, iss: 0.325 },
    { irpj: 0.04, csll: 0.035, cofins: 0.1282, pis: 0.0278, cpp: 0.434, iss: 0.335 },
    { irpj: 0.35, csll: 0.15, cofins: 0.1603, pis: 0.0347, cpp: 0.305 },
  ],
  IV: [
    { irpj: 0.188, csll: 0.152, cofins: 0.1767, pis: 0.0383, iss: 0.445 },
    { irpj: 0.198, csll: 0.152, cofins: 0.2055, pis: 0.0445, iss: 0.4 },
    { irpj: 0.208, csll: 0.152, cofins: 0.1973, pis: 0.0427, iss: 0.4 },
    { irpj: 0.178, csll: 0.192, cofins: 0.189, pis: 0.041, iss: 0.4 },
    { irpj: 0.188, csll: 0.192, cofins: 0.1808, pis: 0.0392, iss: 0.4 },
    { irpj: 0.535, csll: 0.215, cofins: 0.2055, pis: 0.0445 },
  ],
  V: [
    { irpj: 0.25, csll: 0.15, cofins: 0.141, pis: 0.0305, cpp: 0.2885, iss: 0.14 },
    { irpj: 0.23, csll: 0.15, cofins: 0.141, pis: 0.0305, cpp: 0.2785, iss: 0.17 },
    { irpj: 0.24, csll: 0.15, cofins: 0.1492, pis: 0.0323, cpp: 0.2385, iss: 0.19 },
    { irpj: 0.21, csll: 0.15, cofins: 0.1574, pis: 0.0341, cpp: 0.2385, iss: 0.21 },
    { irpj: 0.23, csll: 0.125, cofins: 0.141, pis: 0.0305, cpp: 0.2385, iss: 0.235 },
    { irpj: 0.35, csll: 0.155, cofins: 0.1644, pis: 0.0356, cpp: 0.295 },
  ],
};

function indiceFaixa(rbt12: number): number {
  const indice = LIMITES_FAIXA.findIndex((limite) => rbt12 <= limite);
  return indice === -1 ? LIMITES_FAIXA.length - 1 : indice;
}

export function obterPartilha(anexo: AnexoSimplesNacional, rbt12: number): FaixaPartilha {
  return PARTILHA[anexo][indiceFaixa(rbt12)];
}

/**
 * Percentual de ICMS (Anexos I/II) ou ISS (Anexos III/IV/V) da faixa -- é o que se exclui
 * da alíquota efetiva pra receita com ICMS já recolhido por ST/monofásico. 0 se a faixa
 * não tiver essa coluna (faixa 6, acima do sublimite).
 */
export function percentualIcmsOuIss(faixa: FaixaPartilha): number {
  return faixa.icms ?? faixa.iss ?? 0;
}

/** Percentual de PIS+COFINS da faixa -- exclui da alíquota efetiva pra receita com PIS/COFINS já recolhido por ST/monofásico. */
export function percentualPisCofins(faixa: FaixaPartilha): number {
  return faixa.pis + faixa.cofins;
}

/** Soma de todas as colunas presentes na faixa -- usado só pelo teste de validação (deve ser 1 em toda linha). */
export function somaFaixa(faixa: FaixaPartilha): number {
  return faixa.irpj + faixa.csll + faixa.cofins + faixa.pis + (faixa.cpp ?? 0) + (faixa.ipi ?? 0) + (faixa.icms ?? 0) + (faixa.iss ?? 0);
}

export function todasAsFaixas(): { anexo: AnexoSimplesNacional; indiceFaixa: number; faixa: FaixaPartilha }[] {
  return (Object.keys(PARTILHA) as AnexoSimplesNacional[]).flatMap((anexo) =>
    PARTILHA[anexo].map((faixa, indiceFaixa) => ({ anexo, indiceFaixa, faixa })),
  );
}
