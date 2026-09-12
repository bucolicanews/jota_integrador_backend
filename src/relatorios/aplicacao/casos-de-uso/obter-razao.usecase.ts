import { Inject, Injectable } from '@nestjs/common';
import { naturezaDoGrupo } from '../../../plano-de-contas/dominio/plano-conta';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { RELATORIOS_REPOSITORIO, RelatoriosRepositorioPort } from '../portas/relatorios-repositorio.port';

export interface MovimentoRazao {
  lancamentoId: string;
  dataCompetencia: string;
  historico: string;
  origem: string;
  tipo: 'debito' | 'credito';
  valor: number;
  saldoAcumulado: number;
}

export interface ContaRazao {
  contaId: string;
  codigo: string;
  nome: string;
  grupo: string;
  saldoInicial: number;
  movimentos: MovimentoRazao[];
  saldoFinal: number;
}

@Injectable()
export class ObterRazaoUseCase {
  constructor(
    @Inject(RELATORIOS_REPOSITORIO) private readonly relatorios: RelatoriosRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string, dataInicio: string, dataFim: string, contaId?: string): Promise<ContaRazao[]> {
    const [contas, saldos, movimentos] = await Promise.all([
      this.planoContas.listarPorEmpresa(empresaId),
      this.relatorios.obterSaldosPeriodo(empresaId, dataInicio, dataFim),
      this.relatorios.obterMovimentosPeriodo(empresaId, dataInicio, dataFim, contaId),
    ]);
    const mapaSaldos = new Map(saldos.map((s) => [s.contaId, s]));
    const movimentosPorConta = new Map<string, typeof movimentos>();
    for (const movimento of movimentos) {
      const lista = movimentosPorConta.get(movimento.contaId) ?? [];
      lista.push(movimento);
      movimentosPorConta.set(movimento.contaId, lista);
    }

    const contasAnaliticas = contas.filter((conta) => conta.ativa && !conta.sintetica && (!contaId || conta.id === contaId));

    const resultado: ContaRazao[] = [];
    for (const conta of contasAnaliticas) {
      const saldoInicial = mapaSaldos.get(conta.id)?.saldoInicial ?? 0;
      const natureza = naturezaDoGrupo(conta.grupo);
      const movimentosDaConta = movimentosPorConta.get(conta.id) ?? [];

      let saldoAcumulado = saldoInicial;
      const linhas: MovimentoRazao[] = movimentosDaConta.map((movimento) => {
        const aFavor = movimento.tipo === 'debito' ? natureza === 'devedora' : natureza === 'credora';
        saldoAcumulado += aFavor ? movimento.valor : -movimento.valor;
        return {
          lancamentoId: movimento.lancamentoId,
          dataCompetencia: movimento.dataCompetencia,
          historico: movimento.historico,
          origem: movimento.origem,
          tipo: movimento.tipo,
          valor: movimento.valor,
          saldoAcumulado,
        };
      });

      // Inclui a conta se houve movimento no período OU se o saldo inicial já era
      // diferente de zero -- mesmo critério do jotaCaixa, evita poluir o relatório com
      // contas totalmente zeradas. Quando um contaId específico foi pedido, sempre inclui.
      if (contaId === conta.id || linhas.length > 0 || Math.abs(saldoInicial) > 0.009) {
        resultado.push({
          contaId: conta.id,
          codigo: conta.codigo,
          nome: conta.nome,
          grupo: conta.grupo,
          saldoInicial,
          movimentos: linhas,
          saldoFinal: saldoAcumulado,
        });
      }
    }

    return resultado.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }
}
