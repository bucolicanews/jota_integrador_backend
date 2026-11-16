export type AnexoSimplesNacional = 'I' | 'II' | 'III' | 'IV' | 'V';

/**
 * Catálogo de atividades de SERVIÇO conforme Art. 18 da LC 123/2006 (alterada pela LC
 * 155/2016) -- cobre as atividades mais comuns, não é exaustivo. REVISAR CONTRA O TEXTO
 * OFICIAL VIGENTE antes de usar pra uma declaração real -- a lista completa (com todo
 * CNAE mapeado) é tarefa de contador/advogado tributário, não cabe inteira aqui.
 *
 * §5º-B -- sempre Anexo III, nunca sujeito a Fator R.
 * §5º-C -- sempre Anexo IV (CPP/INSS patronal recolhido por fora, não entra na partilha do DAS).
 * §5º-D/§5º-F -- "serviços intelectuais" -- Fator R decide: ≥28% vai pro Anexo III, <28% pro Anexo V.
 */
export type ChaveAtividadeServico =
  | 'creche_ensino'
  | 'agencia_viagem_turismo'
  | 'agencia_lotericas'
  | 'manutencao_reparacao_geral'
  | 'academia'
  | 'laboratorio_analises'
  | 'transporte_municipal_passageiros'
  | 'construcao_obras'
  | 'vigilancia_limpeza'
  | 'advocacia'
  | 'medicina_odontologia_saude'
  | 'engenharia_arquitetura'
  | 'auditoria_contabilidade_consultoria'
  | 'publicidade_jornalismo'
  | 'design_fotografia'
  | 'representacao_comercial'
  | 'administracao_locacao_imoveis'
  | 'tecnologia_informacao';

interface InfoAtividadeServico {
  rotulo: string;
  /** Quando preenchido, o Anexo é sempre este, Fator R não entra na conta. */
  anexoFixo: AnexoSimplesNacional | null;
  /** true = Fator R decide entre Anexo III (≥28%) e Anexo V (<28%) -- só tem sentido quando anexoFixo é null. */
  sujeitoFatorR: boolean;
}

export const CATALOGO_ATIVIDADES_SERVICO: Record<ChaveAtividadeServico, InfoAtividadeServico> = {
  creche_ensino: { rotulo: 'Creche, pré-escola, ensino fundamental/médio (§5º-B)', anexoFixo: 'III', sujeitoFatorR: false },
  agencia_viagem_turismo: { rotulo: 'Agência de viagem e turismo (§5º-B)', anexoFixo: 'III', sujeitoFatorR: false },
  agencia_lotericas: { rotulo: 'Agência lotérica (§5º-B)', anexoFixo: 'III', sujeitoFatorR: false },
  manutencao_reparacao_geral: { rotulo: 'Manutenção e reparação em geral (§5º-B)', anexoFixo: 'III', sujeitoFatorR: false },
  academia: { rotulo: 'Academia de esporte/atividade física (§5º-B)', anexoFixo: 'III', sujeitoFatorR: false },
  laboratorio_analises: { rotulo: 'Laboratório de análises/patologia (§5º-B)', anexoFixo: 'III', sujeitoFatorR: false },
  transporte_municipal_passageiros: { rotulo: 'Transporte municipal de passageiros (§5º-B)', anexoFixo: 'III', sujeitoFatorR: false },
  construcao_obras: { rotulo: 'Construção de imóveis e obras em geral (§5º-C)', anexoFixo: 'IV', sujeitoFatorR: false },
  vigilancia_limpeza: { rotulo: 'Vigilância, limpeza e conservação (§5º-C)', anexoFixo: 'IV', sujeitoFatorR: false },
  advocacia: { rotulo: 'Serviços advocatícios (§5º-C)', anexoFixo: 'IV', sujeitoFatorR: false },
  medicina_odontologia_saude: { rotulo: 'Medicina, odontologia, psicologia, fisioterapia e afins (§5º-D/F)', anexoFixo: null, sujeitoFatorR: true },
  engenharia_arquitetura: { rotulo: 'Engenharia, arquitetura e urbanismo (§5º-D/F)', anexoFixo: null, sujeitoFatorR: true },
  auditoria_contabilidade_consultoria: { rotulo: 'Auditoria, contabilidade, consultoria, economia (§5º-D/F)', anexoFixo: null, sujeitoFatorR: true },
  publicidade_jornalismo: { rotulo: 'Publicidade e jornalismo (§5º-D/F)', anexoFixo: null, sujeitoFatorR: true },
  design_fotografia: { rotulo: 'Design e fotografia (§5º-D/F)', anexoFixo: null, sujeitoFatorR: true },
  representacao_comercial: { rotulo: 'Representação comercial (§5º-D/F)', anexoFixo: null, sujeitoFatorR: true },
  administracao_locacao_imoveis: { rotulo: 'Administração e locação de bens imóveis de terceiros (§5º-D/F)', anexoFixo: null, sujeitoFatorR: true },
  tecnologia_informacao: { rotulo: 'Tecnologia da informação (desenvolvimento, suporte, TI em geral) (§5º-D/F)', anexoFixo: null, sujeitoFatorR: true },
};

const FATOR_R_MINIMO_ANEXO_III = 0.28;

/**
 * Determina o Anexo da receita de SERVIÇO -- não se aplica à receita de comércio/indústria
 * (sempre Anexo I/II, ver determinarAnexoComercioIndustria).
 */
export function determinarAnexoServico(chaveAtividade: ChaveAtividadeServico, fatorR: number | null): AnexoSimplesNacional {
  const info = CATALOGO_ATIVIDADES_SERVICO[chaveAtividade];
  if (info.anexoFixo) return info.anexoFixo;
  if (!info.sujeitoFatorR) {
    // Nunca deveria acontecer (toda entrada do catálogo tem anexoFixo OU sujeitoFatorR) -- defensivo.
    throw new Error(`Atividade "${chaveAtividade}" sem anexoFixo nem sujeitoFatorR -- catálogo inconsistente`);
  }
  return (fatorR ?? 0) >= FATOR_R_MINIMO_ANEXO_III ? 'III' : 'V';
}

/**
 * Receita de comércio/indústria -- hoje sempre Anexo I (comércio). Anexo II (indústria)
 * exigiria saber se a empresa fabrica o que vende, dado que este sistema ainda não tem
 * (ver plano -- Fase 3 do roadmap, "empresa é indústria" não modelado ainda).
 */
export function determinarAnexoComercioIndustria(): AnexoSimplesNacional {
  return 'I';
}
