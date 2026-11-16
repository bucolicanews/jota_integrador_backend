import { Inject, Injectable } from '@nestjs/common';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { mesesAnteriores, ultimoDiaDoMes } from '../../dominio/receita-mensal';
import { CalcularRbt12UseCase } from './calcular-rbt12.usecase';

export interface ResultadoFatorR {
  folhaPagamento12Meses: number;
  rbt12: number;
  /** null quando rbt12=0 (empresa sem receita no período, Fator R não tem sentido). */
  fatorR: number | null;
  /** false quando nenhuma conta do plano de contas está marcada conta_folha_pagamento -- Fator R não pode ser confiável, sempre 0. */
  temContaConfigurada: boolean;
}

/**
 * Fator R = folha de pagamento dos 12 meses anteriores (salários+encargos+pró-labore, o
 * que o contador marcar como conta_folha_pagamento no Plano de Contas) ÷ RBT12. Decide
 * Anexo III (Fator R ≥ 28%) vs Anexo V pra atividades de serviço elegíveis (Fase 3).
 *
 * Movimento da conta no período = diferença entre o saldo acumulado até o fim do período e
 * até o dia anterior ao início -- reaproveita `obterSaldoConta` (já existe, usado em
 * relatórios) em vez de uma query nova, assumindo que a conta só recebe débito normal
 * (sem estorno que distorça a leitura -- aceitável pra uma primeira versão, revisar se
 * aparecer caso real de estorno dentro do período).
 */
@Injectable()
export class CalcularFatorRUseCase {
  constructor(
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContasRepositorio: PlanoContasRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentosRepositorio: LancamentosRepositorioPort,
    private readonly calcularRbt12: CalcularRbt12UseCase,
  ) {}

  async executar(empresaId: string, competenciaReferencia: string): Promise<ResultadoFatorR> {
    const rbt12 = (await this.calcularRbt12.executar(empresaId, competenciaReferencia)).total;
    const competencias = mesesAnteriores(competenciaReferencia, 12);
    const inicioPeriodo = competencias[0];
    const fimPeriodo = ultimoDiaDoMes(competencias[competencias.length - 1]);
    const diaAnteriorAoInicio = new Date(`${inicioPeriodo}T00:00:00Z`);
    diaAnteriorAoInicio.setUTCDate(diaAnteriorAoInicio.getUTCDate() - 1);
    const anteriorAoInicio = diaAnteriorAoInicio.toISOString().slice(0, 10);

    const contas = await this.planoContasRepositorio.listarPorEmpresa(empresaId);
    const contasFolha = contas.filter((c) => c.contaFolhaPagamento && !c.sintetica);

    if (contasFolha.length === 0) {
      return { folhaPagamento12Meses: 0, rbt12, fatorR: null, temContaConfigurada: false };
    }

    const movimentos = await Promise.all(
      contasFolha.map(async (conta) => {
        const [saldoFim, saldoAntes] = await Promise.all([
          this.lancamentosRepositorio.obterSaldoConta(conta.id, fimPeriodo),
          this.lancamentosRepositorio.obterSaldoConta(conta.id, anteriorAoInicio),
        ]);
        return saldoFim - saldoAntes;
      }),
    );
    const folhaPagamento12Meses = movimentos.reduce((acc, v) => acc + v, 0);

    return {
      folhaPagamento12Meses,
      rbt12,
      fatorR: rbt12 > 0 ? folhaPagamento12Meses / rbt12 : null,
      temContaConfigurada: true,
    };
  }
}
