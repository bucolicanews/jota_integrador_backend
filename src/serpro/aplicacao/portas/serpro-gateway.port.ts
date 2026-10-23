export interface RespostaSerpro {
  sucesso: boolean;
  statusHttp: number;
  corpo: unknown;
}

/**
 * As 5 "funcionalidades" (path) do Integra Contador -- o envelope da requisição é
 * IDÊNTICO nas 5, só o path muda (confirmado contra a doc oficial em 2026-10-21, depois
 * de um 400 real "Esse serviço acionado não é uma funcionalidade do tipo CONSULTAR" ao
 * chamar GERARDAS12 como se fosse Consultar). Default 'Consultar' preserva o
 * comportamento de todo chamador existente (CAIXAPOSTAL, CCMEI, CONSDECLARACAO13/
 * CONSEXTRATO16 são todos Consultar de verdade) -- só quem precisa de outra
 * funcionalidade (ex: Emitir) passa explicitamente.
 */
export type FuncionalidadeSerpro = 'Consultar' | 'Apoiar' | 'Declarar' | 'Emitir' | 'Monitorar';

export interface ParametrosConsultaSerpro {
  idSistema: string;
  idServico: string;
  contribuinteCnpj: string;
  dados?: string;
  /** Só tem efeito em ambiente trial -- ver comentário de `montarEnvelope` (dominio/serpro.ts) sobre por que os cenários de demonstração exigem CNPJs fixos diferentes entre si. */
  documentoTrial?: string;
  /** @default 'Consultar' */
  funcionalidade?: FuncionalidadeSerpro;
}

/**
 * Abstração sobre o gateway HTTP do SERPRO -- ambiente (trial/produção), contratante e
 * formato exato do envelope são detalhes de infraestrutura, resolvidos na implementação
 * (a Application layer só sabe "quero consultar X pra este contribuinte", nunca monta
 * o envelope ela mesma). Ver docs/SEGURANCA.md §3.
 */
export interface SerproGatewayPort {
  consultar(params: ParametrosConsultaSerpro): Promise<RespostaSerpro>;
}

export const SERPRO_GATEWAY = Symbol('SERPRO_GATEWAY');
