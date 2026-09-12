import { Inject, Injectable } from '@nestjs/common';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { RELATORIOS_REPOSITORIO, RelatoriosRepositorioPort } from '../portas/relatorios-repositorio.port';

export interface ContaBalancete {
  contaId: string;
  codigo: string;
  nome: string;
  grupo: string;
  sintetica: boolean;
  saldoInicial: number;
  totalDebito: number;
  totalCredito: number;
  saldoFinal: number;
}

export interface Balancete {
  contas: ContaBalancete[];
  totalDebito: number;
  totalCredito: number;
  totalSaldoFinal: number;
}

@Injectable()
export class ObterBalanceteUseCase {
  constructor(
    @Inject(RELATORIOS_REPOSITORIO) private readonly relatorios: RelatoriosRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
  ) {}

  async executar(empresaId: string, dataInicio: string, dataFim: string): Promise<Balancete> {
    const [contas, saldos] = await Promise.all([
      this.planoContas.listarPorEmpresa(empresaId),
      this.relatorios.obterSaldosPeriodo(empresaId, dataInicio, dataFim),
    ]);
    const mapaSaldos = new Map(saldos.map((s) => [s.contaId, s]));

    const linhas: ContaBalancete[] = contas
      .filter((conta) => conta.ativa)
      .map((conta) => {
        const saldo = mapaSaldos.get(conta.id);
        return {
          contaId: conta.id,
          codigo: conta.codigo,
          nome: conta.nome,
          grupo: conta.grupo,
          sintetica: conta.sintetica,
          saldoInicial: saldo?.saldoInicial ?? 0,
          totalDebito: saldo?.totalDebito ?? 0,
          totalCredito: saldo?.totalCredito ?? 0,
          saldoFinal: saldo?.saldoFinal ?? 0,
        };
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    const analiticas = linhas.filter((l) => !l.sintetica);
    return {
      contas: linhas,
      totalDebito: analiticas.reduce((soma, l) => soma + l.totalDebito, 0),
      totalCredito: analiticas.reduce((soma, l) => soma + l.totalCredito, 0),
      totalSaldoFinal: analiticas.reduce((soma, l) => soma + l.saldoFinal, 0),
    };
  }
}
