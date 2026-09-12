import { Inject, Injectable } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { RELATORIOS_REPOSITORIO, RelatoriosRepositorioPort } from '../portas/relatorios-repositorio.port';

export interface ContaBalanco {
  contaId: string;
  codigo: string;
  nome: string;
  grupo: string;
  sintetica: boolean;
  saldoFinal: number;
}

export interface BalancoPatrimonial {
  contas: ContaBalanco[];
  totalAtivo: number;
  totalPassivo: number;
  totalPatrimonioLiquido: number;
  resultadoLiquido: number;
  totalPassivoPl: number;
  fechado: boolean;
}

@Injectable()
export class ObterBalancoPatrimonialUseCase {
  constructor(
    @Inject(RELATORIOS_REPOSITORIO) private readonly relatorios: RelatoriosRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string, dataFim: string): Promise<BalancoPatrimonial> {
    const [contas, saldos] = await Promise.all([
      this.planoContas.listarPorEmpresa(empresaId),
      // p_data_inicio null = saldo desde sempre até dataFim -- é isso que o Balanço precisa.
      this.relatorios.obterSaldosPeriodo(empresaId, null, dataFim),
    ]);
    const mapaSaldos = new Map(saldos.map((s) => [s.contaId, s]));

    const linhas: ContaBalanco[] = contas
      .filter((conta) => conta.ativa)
      .map((conta) => ({
        contaId: conta.id,
        codigo: conta.codigo,
        nome: conta.nome,
        grupo: conta.grupo,
        sintetica: conta.sintetica,
        saldoFinal: mapaSaldos.get(conta.id)?.saldoFinal ?? 0,
      }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    const somaGrupo = (grupo: string) =>
      linhas.filter((l) => !l.sintetica && l.grupo === grupo).reduce((soma, l) => soma + l.saldoFinal, 0);

    const totalAtivo = somaGrupo('ativo');
    const totalPassivo = somaGrupo('passivo');
    const totalPatrimonioLiquido = somaGrupo('patrimonio_liquido');
    // Resultado do exercício (Receita - Custo - Despesa) acumulado desde sempre -- não
    // existe lançamento de encerramento de período neste sistema, então isso é o que
    // fecha o balanço do lado do Passivo+PL (mesmo raciocínio do jotaCaixa).
    const totalReceita = somaGrupo('receita');
    const totalCusto = somaGrupo('custo');
    const totalDespesa = somaGrupo('despesa');
    const resultadoLiquido = totalReceita - totalCusto - totalDespesa;
    const totalPassivoPl = totalPassivo + totalPatrimonioLiquido + resultadoLiquido;

    return {
      contas: linhas,
      totalAtivo,
      totalPassivo,
      totalPatrimonioLiquido,
      resultadoLiquido,
      totalPassivoPl,
      fechado: Math.abs(totalAtivo - totalPassivoPl) < 0.01,
    };
  }
}
