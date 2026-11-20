export type StatusNotaServico = 'capturada' | 'aprovada' | 'rejeitada';

/**
 * NFS-e Nacional, 1 serviço por nota (diferente de NFe/NFCe -- sem lista de itens). Campos
 * confirmados verbatim contra `internal/domain/models/models.go` do próprio gerador de
 * DANFSe da RFB (github.com/ReceitaFederal/calculadora-rtc-gerador-danfse, 2026-11-20) --
 * mesmo nível de confiança que os records Java usados pra RTC Simples/Regime Regular.
 * Campos de `toma`/`prest` dentro de `DPS/infDPS` não totalmente confirmados campo a campo
 * (resumo de IA sobre o fonte, não leitura linha a linha) -- tratar como alta confiança, não
 * como certeza absoluta.
 */
export interface NotaServicoExtraida {
  /** infNFSe/@Id -- "NFS"+cMun(7)+ambGer(1)+tpInsc(1)+inscrFederal(14)+nNFSe(13)+anoMes(4)+cNum(9)+DV(1), formato confirmado no XSD oficial v1.01. */
  chaveAcesso: string;
  /** infNFSe/@situacao -- válida/substituída/cancelada (bruto, nunca normalizado -- mesmo princípio de cst_csosn em notas_fiscais_itens). */
  situacao: string;
  numeroNfse: string;
  /** infNFSe/dhProc -- data/hora de processamento pelo Ambiente de Dados Nacional. */
  dataProcessamento: string;
  /** infNFSe/DPS/infDPS/dhEmi -- data/hora de emissão do DPS pelo prestador. */
  dataEmissaoDps: string;
  emitenteCnpj: string | null;
  emitenteCpf: string | null;
  emitenteNome: string;
  tomadorCnpj: string | null;
  tomadorCpf: string | null;
  tomadorNome: string | null;
  /** DPS/infDPS/serv/cServ/xDescServ. */
  descricaoServico: string;
  /** DPS/infDPS/serv/cServ/cTribNac. */
  codigoTributacaoNacional: string | null;
  valorLiquido: number;
  valorIssqn: number;
  valorBaseCalculo: number;
  /** Parse completo do XML -- nunca perde dado não mapeado nos campos tipados acima, mesmo princípio de xmlBruto em nota-fiscal.ts. */
  xmlBruto: unknown;
}
