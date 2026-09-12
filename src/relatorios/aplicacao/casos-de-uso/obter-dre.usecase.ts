import { Inject, Injectable } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { RELATORIOS_REPOSITORIO, RelatoriosRepositorioPort } from '../portas/relatorios-repositorio.port';

export interface ContaDre {
  contaId: string;
  codigo: string;
  nome: string;
  grupo: 'receita' | 'custo' | 'despesa';
  sintetica: boolean;
  valorPeriodo: number;
}

export interface Dre {
  contas: ContaDre[];
  totalReceita: number;
  totalCusto: number;
  totalDespesa: number;
  resultadoLiquido: number;
}

const GRUPOS_DRE = ['receita', 'custo', 'despesa'] as const;

@Injectable()
export class ObterDreUseCase {
  constructor(
    @Inject(RELATORIOS_REPOSITORIO) private readonly relatorios: RelatoriosRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string, dataInicio: string, dataFim: string): Promise<Dre> {
    const [contas, saldos] = await Promise.all([
      this.planoContas.listarPorEmpresa(empresaId),
      this.relatorios.obterSaldosPeriodo(empresaId, dataInicio, dataFim),
    ]);
    const mapaSaldos = new Map(saldos.map((s) => [s.contaId, s]));

    const linhas: ContaDre[] = contas
      .filter((conta) => conta.ativa && (GRUPOS_DRE as readonly string[]).includes(conta.grupo))
      .map((conta) => {
        const saldo = mapaSaldos.get(conta.id);
        // O movimento do período é exatamente saldoFinal - saldoInicial (saldoInicial já
        // fica 0 se a conta não tinha nada antes de dataInicio) -- isolamos só o que
        // aconteceu dentro do período, sem carregar acumulado de períodos anteriores
        // (não existe lançamento de encerramento neste sistema).
        const valorPeriodo = (saldo?.saldoFinal ?? 0) - (saldo?.saldoInicial ?? 0);
        return {
          contaId: conta.id,
          codigo: conta.codigo,
          nome: conta.nome,
          grupo: conta.grupo as 'receita' | 'custo' | 'despesa',
          sintetica: conta.sintetica,
          valorPeriodo,
        };
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    const somaGrupo = (grupo: 'receita' | 'custo' | 'despesa') =>
      linhas.filter((l) => !l.sintetica && l.grupo === grupo).reduce((soma, l) => soma + l.valorPeriodo, 0);

    const totalReceita = somaGrupo('receita');
    const totalCusto = somaGrupo('custo');
    const totalDespesa = somaGrupo('despesa');

    return {
      contas: linhas,
      totalReceita,
      totalCusto,
      totalDespesa,
      resultadoLiquido: totalReceita - totalCusto - totalDespesa,
    };
  }
}
