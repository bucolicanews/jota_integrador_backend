import { AnexoSimplesNacional, CATALOGO_ATIVIDADES_SERVICO, ChaveAtividadeServico } from '../../apuracao-simples/dominio/catalogo-anexos-simples';

/**
 * `idAtividade` -- código oficial do PGDAS-D (serviço TRANSDECLARACAO11/PGDASD) que
 * identifica o tipo de atividade/tributação de cada receita declarada. NÃO é CNAE.
 * Reconstruído via fragmentos indexados da página oficial
 * `apicenter.estaleiro.serpro.gov.br/.../sistemas/pgdasd/dados_de_dominio/` em 2026-11-14
 * (página retornando HTTP 500 real no momento da pesquisa -- confirmado via WebFetch,
 * proxy leitor E curl direto com UA de navegador, 3 vias independentes, nunca lida na
 * íntegra) -- cada código abaixo foi citado de forma consistente em buscas diferentes,
 * mas **nenhum foi confirmado contra chamada real do SERPRO ainda** (ver Fase de
 * verificação do plano -- testar contra o trial `00000000000000` antes de confiar em
 * produção). Códigos 9 e 25-28 nunca apareceram em nenhuma busca -- por isso Anexo V e
 * qualquer caso que exigisse um desses ficam bloqueados (ver `resolverIdAtividade`).
 *
 * REVISAR CONTRA A DOC OFICIAL (retentar a página acima) antes de confiar nisto pra uma
 * declaração real de cliente.
 */

/** Comércio/indústria (Anexo I/II) -- 1/2 comércio sem/com ICMS-ST-monofásico, 4/5 indústria sem/com. */
const ID_ATIVIDADE_COMERCIO_NORMAL = 1;
const ID_ATIVIDADE_COMERCIO_ST = 2;
const ID_ATIVIDADE_INDUSTRIA_NORMAL = 4;
const ID_ATIVIDADE_INDUSTRIA_ST = 5;

/** Serviço Anexo III, SUJEITO ao Fator R (migrou pra III por Fator R >= 28%) -- outro município / próprio município / com retenção-ST de ISS. */
const ID_ATIVIDADE_III_FATOR_R = { outroMunicipio: 10, proprioMunicipio: 11, comRetencao: 12 } as const;
/** Serviço Anexo III, NÃO sujeito ao Fator R (§5º-B, sempre III por lei). */
const ID_ATIVIDADE_III_SEM_FATOR_R = { outroMunicipio: 13, proprioMunicipio: 14, comRetencao: 15 } as const;
/** Serviço Anexo IV (§5º-C, CPP recolhida por fora, nunca depende de Fator R). */
const ID_ATIVIDADE_IV = { outroMunicipio: 16, proprioMunicipio: 17, comRetencao: 18 } as const;
/** Construção civil (LC 116/2003 7.02/7.05) tributada por Anexo III. */
const ID_ATIVIDADE_CONSTRUCAO_III = { outroMunicipio: 19, proprioMunicipio: 20, comRetencao: 21 } as const;
/** Construção civil (LC 116/2003 7.02/7.05) tributada por Anexo IV. */
const ID_ATIVIDADE_CONSTRUCAO_IV = { outroMunicipio: 22, proprioMunicipio: 23, comRetencao: 24 } as const;

export class AnexoNaoSuportadoPgdasdError extends Error {}

function escolherPorMunicipioRetencao(
  grupo: { outroMunicipio: number; proprioMunicipio: number; comRetencao: number },
  issRetidoNaFonte: boolean,
  issDevidoAOutroMunicipio: boolean,
): number {
  if (issRetidoNaFonte) return grupo.comRetencao;
  return issDevidoAOutroMunicipio ? grupo.outroMunicipio : grupo.proprioMunicipio;
}

/**
 * Comércio/indústria -- `temIcmsStOuMonofasico` vem do balde `icms_ja_recolhido`/
 * `ambos_ja_recolhidos` da Fase 4.5 (`categorizar-tributacao-item.ts`). Indústria (Anexo
 * II) nunca acontece hoje (`determinarAnexoComercioIndustria` sempre devolve 'I') -- os
 * códigos 4/5 ficam prontos pra quando esse campo existir, sem uso real ainda.
 */
export function resolverIdAtividadeComercioIndustria(anexo: AnexoSimplesNacional, temIcmsStOuMonofasico: boolean): number {
  if (anexo === 'I') return temIcmsStOuMonofasico ? ID_ATIVIDADE_COMERCIO_ST : ID_ATIVIDADE_COMERCIO_NORMAL;
  if (anexo === 'II') return temIcmsStOuMonofasico ? ID_ATIVIDADE_INDUSTRIA_ST : ID_ATIVIDADE_INDUSTRIA_NORMAL;
  throw new AnexoNaoSuportadoPgdasdError(`Anexo ${anexo} não é válido pra receita de comércio/indústria`);
}

/**
 * Serviço -- Anexo V bloqueado de propósito (códigos 25-28 nunca confirmados, ver
 * comentário do arquivo). `construcao_obras` usa a tabela própria de construção civil
 * mesmo caindo em Anexo IV, porque LC 116/2003 7.02/7.05 tem código PGDAS-D distinto do
 * genérico Anexo IV.
 */
export function resolverIdAtividadeServico(
  anexo: AnexoSimplesNacional,
  chaveAtividadeServico: ChaveAtividadeServico,
  issRetidoNaFonte: boolean,
  issDevidoAOutroMunicipio: boolean,
): number {
  if (anexo === 'V') {
    throw new AnexoNaoSuportadoPgdasdError(
      'Anexo V ainda não suportado pela transmissão automática -- código idAtividade (25-28) nunca confirmado contra a doc oficial do SERPRO. Lance manualmente no Portal do Simples Nacional.',
    );
  }
  if (anexo !== 'III' && anexo !== 'IV') {
    throw new AnexoNaoSuportadoPgdasdError(`Anexo ${anexo} não é válido pra receita de serviço`);
  }

  if (chaveAtividadeServico === 'construcao_obras') {
    const grupo = anexo === 'III' ? ID_ATIVIDADE_CONSTRUCAO_III : ID_ATIVIDADE_CONSTRUCAO_IV;
    return escolherPorMunicipioRetencao(grupo, issRetidoNaFonte, issDevidoAOutroMunicipio);
  }

  if (anexo === 'IV') {
    return escolherPorMunicipioRetencao(ID_ATIVIDADE_IV, issRetidoNaFonte, issDevidoAOutroMunicipio);
  }

  // Anexo III: distinguir "migrou pra III por Fator R" (sujeitoFatorR=true no catálogo)
  // de "sempre III por lei, nunca depende de Fator R" (§5º-B, sujeitoFatorR=false) --
  // são dois grupos de código diferentes na tabela oficial (10-12 vs 13-15).
  const info = CATALOGO_ATIVIDADES_SERVICO[chaveAtividadeServico];
  const grupo = info.sujeitoFatorR ? ID_ATIVIDADE_III_FATOR_R : ID_ATIVIDADE_III_SEM_FATOR_R;
  return escolherPorMunicipioRetencao(grupo, issRetidoNaFonte, issDevidoAOutroMunicipio);
}
