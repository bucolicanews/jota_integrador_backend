import { Inject, Injectable } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { RELATORIOS_REPOSITORIO, RelatoriosRepositorioPort } from '../portas/relatorios-repositorio.port';

export interface ContaFluxoCaixa {
  contaId: string;
  codigo: string;
  nome: string;
  saldoInicial: number;
  saldoFinal: number;
}

export interface MovimentoFluxoCaixa {
  contaId: string;
  contaNome: string;
  lancamentoId: string;
  dataCompetencia: string;
  historico: string;
  origem: string;
  tipo: 'debito' | 'credito';
  valor: number;
}

export interface FluxoCaixa {
  contas: ContaFluxoCaixa[];
  totalSaldoInicial: number;
  totalSaldoFinal: number;
  movimentos: MovimentoFluxoCaixa[];
}

@Injectable()
export class ObterFluxoCaixaUseCase {
  constructor(
    @Inject(RELATORIOS_REPOSITORIO) private readonly relatorios: RelatoriosRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string, dataInicio: string, dataFim: string): Promise<FluxoCaixa> {
    const todasContas = await this.planoContas.listarPorEmpresa(empresaId);
    const contasCaixaBanco = todasContas.filter((conta) => conta.ativa && !conta.sintetica && conta.contaCaixaBanco);
    const contaIds = new Set(contasCaixaBanco.map((c) => c.id));

    const saldos = await this.relatorios.obterSaldosPeriodo(empresaId, dataInicio, dataFim);
    const mapaSaldos = new Map(saldos.map((s) => [s.contaId, s]));

    // Movimentos de todas as contas caixa/banco, uma chamada por conta (número de contas
    // caixa/banco é tipicamente pequeno -- poucas dezenas no máximo).
    const movimentosPorConta = await Promise.all(
      [...contaIds].map((contaId) => this.relatorios.obterMovimentosPeriodo(empresaId, dataInicio, dataFim, contaId)),
    );
    const nomePorConta = new Map(contasCaixaBanco.map((c) => [c.id, c]));

    const movimentos: MovimentoFluxoCaixa[] = movimentosPorConta
      .flat()
      .map((movimento) => ({
        contaId: movimento.contaId,
        contaNome: nomePorConta.get(movimento.contaId)?.nome ?? '',
        lancamentoId: movimento.lancamentoId,
        dataCompetencia: movimento.dataCompetencia,
        historico: movimento.historico,
        origem: movimento.origem,
        tipo: movimento.tipo,
        valor: movimento.valor,
      }))
      .sort((a, b) => a.dataCompetencia.localeCompare(b.dataCompetencia));

    const contas: ContaFluxoCaixa[] = contasCaixaBanco.map((conta) => ({
      contaId: conta.id,
      codigo: conta.codigo,
      nome: conta.nome,
      saldoInicial: mapaSaldos.get(conta.id)?.saldoInicial ?? 0,
      saldoFinal: mapaSaldos.get(conta.id)?.saldoFinal ?? 0,
    }));

    return {
      contas,
      totalSaldoInicial: contas.reduce((soma, c) => soma + c.saldoInicial, 0),
      totalSaldoFinal: contas.reduce((soma, c) => soma + c.saldoFinal, 0),
      movimentos,
    };
  }
}
