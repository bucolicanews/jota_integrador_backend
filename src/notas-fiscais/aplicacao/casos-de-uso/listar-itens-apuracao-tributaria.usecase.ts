import { Inject, Injectable } from '@nestjs/common';
import { CategoriaTributacaoItem, categorizarItem } from '../../../apuracao-simples/dominio/categorizar-tributacao-item';
import { DirecaoNotaFiscal, StatusNotaFiscal } from '../../dominio/nota-fiscal';
import { NOTAS_FISCAIS_REPOSITORIO, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';

export interface ItemApuracaoTributaria {
  notaFiscalId: string;
  direcao: DirecaoNotaFiscal;
  cfop: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  contraparte: string;
  statusNota: StatusNotaFiscal;
  descricao: string;
  quantidade: number;
  valorTotal: number;
  valorIcms: number;
  valorIcmsSt: number;
  valorPis: number;
  valorCofins: number;
  valorCbs: number;
  valorIbs: number;
  /** Normal / ICMS-ST-ou-monofásico já recolhido / PIS-COFINS-ST-ou-monofásico já recolhido / ambos -- ver categorizar-tributacao-item.ts (Fase 4.5 da apuração do Simples). */
  categoriaTributacao: CategoriaTributacaoItem;
}

/**
 * Base de dados do painel de Apuração Tributária -- junta notas_fiscais_itens (CFOP,
 * impostos destacados) com o contexto da nota (direção, contraparte, status) pro frontend
 * agrupar por CFOP e montar a listagem (ex: só CFOP 5404) e o cálculo débito/crédito de
 * CBS/IBS do Simples Híbrido. Toda a agregação (por CFOP, débito-crédito) é feita no
 * frontend -- mesmo padrão já usado em PainelNotasFiscais (fetch bruto, agrega em JS).
 */
@Injectable()
export class ListarItensApuracaoTributariaUseCase {
  constructor(@Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: NotasFiscaisRepositorioPort) {}

  async executar(empresaId: string, dataInicio: string, dataFim: string): Promise<ItemApuracaoTributaria[]> {
    const notas = await this.repositorio.listarPorPeriodo(empresaId, dataInicio, dataFim);
    if (notas.length === 0) return [];

    const notasPorId = new Map(notas.map((nota) => [nota.id, nota]));
    const itens = await this.repositorio.listarItensPorNotas(notas.map((nota) => nota.id));

    const resultado: ItemApuracaoTributaria[] = [];
    for (const item of itens) {
      const nota = notasPorId.get(item.notaFiscalId);
      if (!nota) continue; // defensivo -- não deveria acontecer, item sempre pertence a uma das notas buscadas
      resultado.push({
        notaFiscalId: nota.id,
        direcao: nota.direcao,
        cfop: item.cfop,
        numero: nota.numero,
        serie: nota.serie,
        dataEmissao: nota.dataEmissao,
        contraparte: nota.direcao === 'entrada' ? nota.emitenteNome : nota.destinatarioNome ?? 'Consumidor final',
        statusNota: nota.status,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorTotal: item.valorTotal,
        valorIcms: item.valorIcms,
        valorIcmsSt: item.valorIcmsSt,
        valorPis: item.valorPis,
        valorCofins: item.valorCofins,
        valorCbs: item.valorCbs,
        valorIbs: item.valorIbs,
        categoriaTributacao: categorizarItem(item),
      });
    }
    return resultado;
  }
}
