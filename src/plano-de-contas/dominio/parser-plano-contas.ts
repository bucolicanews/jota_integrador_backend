import * as Papa from 'papaparse';
import { GRUPOS_CONTA_CONTABIL, GrupoContaContabil } from './plano-conta';

export interface LinhaPlanoContaBruta {
  [coluna: string]: unknown;
}

export interface LinhaPlanoContaImportada {
  codigo: string;
  nome: string;
  grupo: GrupoContaContabil;
  sintetica: boolean;
  codigoPai: string | null;
  contaCaixaBanco: boolean;
  contaAReceber: boolean;
  contaAPagar: boolean;
}

export interface ResultadoParsePlanoContas {
  linhas: LinhaPlanoContaImportada[];
  erros: string[];
}

const RÓTULOS_GRUPO: Record<string, GrupoContaContabil> = {
  ativo: 'ativo',
  passivo: 'passivo',
  patrimonio_liquido: 'patrimonio_liquido',
  'patrimônio líquido': 'patrimonio_liquido',
  'patrimonio liquido': 'patrimonio_liquido',
  receita: 'receita',
  custo: 'custo',
  despesa: 'despesa',
};

function normalizarBooleano(valor: unknown): boolean {
  const texto = String(valor ?? '').trim().toLowerCase();
  return texto === 'sim' || texto === 'true' || texto === '1' || texto === 'x';
}

function normalizarGrupo(valor: unknown): GrupoContaContabil | null {
  const texto = String(valor ?? '').trim().toLowerCase();
  return RÓTULOS_GRUPO[texto] ?? null;
}

/**
 * Converte linhas já parseadas do CSV (Papa.parse com header:true) em contas tipadas,
 * validando linha a linha. Nunca lança -- devolve os erros pro usecase decidir (falhar
 * sem alterar nada é regra do caller, não deste parser).
 */
export function parsearPlanoContasCsv(linhas: LinhaPlanoContaBruta[]): ResultadoParsePlanoContas {
  const erros: string[] = [];
  const resultado: LinhaPlanoContaImportada[] = [];
  const codigosVistos = new Set<string>();

  linhas.forEach((linha, indice) => {
    const numeroLinha = indice + 2; // +1 pelo header, +1 por índice 0-based
    const codigo = String(linha.Codigo ?? linha.codigo ?? '').trim();
    const nome = String(linha.Nome ?? linha.nome ?? '').trim();
    const grupoBruto = linha.Grupo ?? linha.grupo;
    const sinteticaBruta = linha.Sintetica ?? linha.sintetica;
    const codigoPai = String(linha.CodigoPai ?? linha.codigoPai ?? '').trim() || null;

    if (!codigo) {
      erros.push(`Linha ${numeroLinha}: coluna "Codigo" é obrigatória.`);
      return;
    }
    if (codigosVistos.has(codigo)) {
      erros.push(`Linha ${numeroLinha}: código "${codigo}" repetido no arquivo.`);
      return;
    }
    if (!nome || nome.length < 2) {
      erros.push(`Linha ${numeroLinha} (${codigo}): coluna "Nome" é obrigatória (mínimo 2 caracteres).`);
      return;
    }
    const grupo = normalizarGrupo(grupoBruto);
    if (!grupo) {
      erros.push(
        `Linha ${numeroLinha} (${codigo}): "Grupo" inválido ("${grupoBruto}"). Use um de: ${GRUPOS_CONTA_CONTABIL.join(', ')}.`,
      );
      return;
    }

    codigosVistos.add(codigo);
    resultado.push({
      codigo,
      nome,
      grupo,
      sintetica: normalizarBooleano(sinteticaBruta),
      codigoPai,
      contaCaixaBanco: normalizarBooleano(linha.ContaCaixaBanco ?? linha.contaCaixaBanco),
      contaAReceber: normalizarBooleano(linha.ContaAReceber ?? linha.contaAReceber),
      contaAPagar: normalizarBooleano(linha.ContaAPagar ?? linha.contaAPagar),
    });
  });

  // Validação de referência cruzada: CodigoPai precisa existir no arquivo e ser sintética.
  const porCodigo = new Map(resultado.map((l) => [l.codigo, l]));
  for (const linha of resultado) {
    if (!linha.codigoPai) continue;
    const pai = porCodigo.get(linha.codigoPai);
    if (!pai) {
      erros.push(`Conta "${linha.codigo}": CodigoPai "${linha.codigoPai}" não existe no arquivo.`);
    } else if (!pai.sintetica) {
      erros.push(`Conta "${linha.codigo}": CodigoPai "${linha.codigoPai}" precisa ser sintética (agrupadora).`);
    }
  }

  return { linhas: resultado, erros };
}

const CABECALHO_CSV = ['Codigo', 'Nome', 'Grupo', 'Sintetica', 'CodigoPai', 'ContaCaixaBanco', 'ContaAReceber', 'ContaAPagar'];

/** Mesmo formato pros dois consumidores: exportar o plano real de uma empresa e baixar um modelo padrão. */
export function construirCsvPlanoContas(linhas: LinhaPlanoContaImportada[]): string {
  const dados = linhas.map((l) => ({
    Codigo: l.codigo,
    Nome: l.nome,
    Grupo: l.grupo,
    Sintetica: l.sintetica ? 'Sim' : 'Não',
    CodigoPai: l.codigoPai ?? '',
    ContaCaixaBanco: l.contaCaixaBanco ? 'Sim' : 'Não',
    ContaAReceber: l.contaAReceber ? 'Sim' : 'Não',
    ContaAPagar: l.contaAPagar ? 'Sim' : 'Não',
  }));
  return Papa.unparse({ fields: CABECALHO_CSV, data: dados });
}
