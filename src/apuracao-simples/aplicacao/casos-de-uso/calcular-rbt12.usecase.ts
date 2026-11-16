import { Inject, Injectable } from '@nestjs/common';
import { NOTAS_FISCAIS_REPOSITORIO, NotasFiscaisRepositorioPort } from '../../../notas-fiscais/aplicacao/portas/notas-fiscais-repositorio.port';
import { mesesAnteriores, ultimoDiaDoMes } from '../../dominio/receita-mensal';
import { RECEITAS_MENSAIS_REPOSITORIO, ReceitasMensaisRepositorioPort } from '../portas/receitas-mensais-repositorio.port';

export interface MesRbt12 {
  competencia: string;
  comercioIndustria: number;
  servico: number;
  /** De onde veio comercioIndustria -- servico nunca é derivado de nota (este sistema não captura NFS-e). */
  origemComercioIndustria: 'notas_fiscais' | 'manual' | 'ausente';
}

export interface ResultadoRbt12 {
  competenciaReferencia: string;
  meses: MesRbt12[];
  totalComercioIndustria: number;
  totalServico: number;
  total: number;
}

/**
 * RBT12 = receita bruta dos 12 meses ANTERIORES à competência de referência (nunca inclui
 * o próprio mês -- regra do Simples Nacional), segregada por tipo de atividade porque cada
 * um apura em Anexo diferente (CalcularAnexoUseCase, Fase 3).
 *
 * Mês a mês: se existir nota de SAÍDA aprovada emitida naquele mês, usa a soma das notas
 * (comercio_industria -- este sistema só captura NFe/NFCe, nunca NFS-e). Senão, cai pro
 * valor manual em receitas_mensais_historico (empresa usou o sistema há menos de 12 meses,
 * ou o contador ainda não aprovou as notas daquele mês). Receita de serviço NUNCA é
 * derivada de nota -- sempre manual, sempre.
 */
@Injectable()
export class CalcularRbt12UseCase {
  constructor(
    @Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly notasFiscaisRepositorio: NotasFiscaisRepositorioPort,
    @Inject(RECEITAS_MENSAIS_REPOSITORIO) private readonly receitasRepositorio: ReceitasMensaisRepositorioPort,
  ) {}

  async executar(empresaId: string, competenciaReferencia: string): Promise<ResultadoRbt12> {
    const competencias = mesesAnteriores(competenciaReferencia, 12);
    const inicio = competencias[0];
    const fim = ultimoDiaDoMes(competencias[competencias.length - 1]);

    const [notas, manuais] = await Promise.all([
      this.notasFiscaisRepositorio.listarPorPeriodo(empresaId, inicio, fim),
      this.receitasRepositorio.listarPorPeriodo(empresaId, inicio, fim),
    ]);

    const notasValidas = notas.filter((n) => n.direcao === 'saida' && n.status === 'aprovada');
    const somaNotasPorMes = new Map<string, number>();
    for (const nota of notasValidas) {
      const mes = `${nota.dataEmissao.slice(0, 7)}-01`;
      somaNotasPorMes.set(mes, (somaNotasPorMes.get(mes) ?? 0) + nota.valorTotal);
    }

    const manualPorMesETipo = new Map<string, number>();
    for (const r of manuais) {
      manualPorMesETipo.set(`${r.competencia}:${r.tipoAtividade}`, r.valor);
    }

    const meses: MesRbt12[] = competencias.map((competencia) => {
      const valorNotas = somaNotasPorMes.get(competencia);
      const manualComercio = manualPorMesETipo.get(`${competencia}:comercio_industria`);
      const manualServico = manualPorMesETipo.get(`${competencia}:servico`) ?? 0;

      const comercioIndustria = valorNotas ?? manualComercio ?? 0;
      const origemComercioIndustria: MesRbt12['origemComercioIndustria'] =
        valorNotas !== undefined ? 'notas_fiscais' : manualComercio !== undefined ? 'manual' : 'ausente';

      return { competencia, comercioIndustria, servico: manualServico, origemComercioIndustria };
    });

    const totalComercioIndustria = meses.reduce((acc, m) => acc + m.comercioIndustria, 0);
    const totalServico = meses.reduce((acc, m) => acc + m.servico, 0);

    return {
      competenciaReferencia,
      meses,
      totalComercioIndustria,
      totalServico,
      total: totalComercioIndustria + totalServico,
    };
  }
}
