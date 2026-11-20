import { XMLParser } from 'fast-xml-parser';
import { NotaServicoExtraida } from './nota-servico';

/** Mesmo motivo de parser-xml-nfe.ts: parseTagValue/parseAttributeValue desligados pra não destruir código com zero à esquerda (ex. cTribNac). */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

function paraNumero(valor: unknown): number {
  if (valor === undefined || valor === null || valor === '') return 0;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Parse de uma NFS-e Nacional já processada (não o DPS de envio) -- estrutura confirmada
 * contra `internal/domain/models/models.go` do gerador de DANFSe oficial da RFB:
 * `NFSe/infNFSe` (com `@Id`=chave de acesso, `@situacao`), `DPS/infDPS` embarcado (`toma`,
 * `serv/cServ`), `emit` e `valores` direto em `infNFSe`. `toma`/`serv` vêm de dentro de
 * `DPS/infDPS`, não de `infNFSe` -- diferença real de estrutura em relação à NFe (onde
 * tudo fica direto em infNFe), não erro de digitação.
 */
export function parseXmlNfse(xmlBruto: string): NotaServicoExtraida {
  const raiz = parser.parse(xmlBruto);
  const nfse = raiz.NFSe;
  const infNFSe = nfse?.infNFSe;
  if (!infNFSe) {
    throw new Error('XML não é uma NFS-e Nacional reconhecível (elemento infNFSe não encontrado)');
  }

  const infDPS = infNFSe.DPS?.infDPS ?? {};
  const emit = infNFSe.emit ?? {};
  const toma = infDPS.toma ?? {};
  const cServ = infDPS.serv?.cServ ?? {};
  const valores = infNFSe.valores ?? {};

  return {
    chaveAcesso: String(infNFSe['@_Id'] ?? ''),
    situacao: String(infNFSe['@_situacao'] ?? ''),
    numeroNfse: infNFSe.nNFSe ?? '',
    dataProcessamento: infNFSe.dhProc ?? '',
    dataEmissaoDps: infDPS.dhEmi ?? '',
    emitenteCnpj: emit.CNPJ ?? null,
    emitenteCpf: emit.CPF ?? null,
    emitenteNome: emit.xNome ?? '',
    tomadorCnpj: toma.CNPJ ?? null,
    tomadorCpf: toma.CPF ?? null,
    tomadorNome: toma.xNome ?? null,
    descricaoServico: cServ.xDescServ ?? '',
    codigoTributacaoNacional: cServ.cTribNac ?? null,
    valorLiquido: paraNumero(valores.vLiq),
    valorIssqn: paraNumero(valores.vISSQN),
    valorBaseCalculo: paraNumero(valores.vBC),
    xmlBruto: raiz,
  };
}
