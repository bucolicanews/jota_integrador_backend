import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTAS_PAGAR_REPOSITORIO, ContasPagarRepositorioPort } from '../../../contas-a-pagar/aplicacao/portas/contas-pagar-repositorio.port';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort } from '../../../contas-a-receber/aplicacao/portas/contas-receber-repositorio.port';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort } from '../portas/conciliacao-repositorio.port';

export interface ParcelaCandidata {
  parcelaId: string;
  tipo: 'CP' | 'CR';
  descricao: string;
  numeroParcela: number;
  valorParcela: number;
  valorRestante: number;
  dataVencimento: string;
  compatibilidade: 'alta' | 'media' | 'baixa';
}

const JANELA_DIAS = 15;

/**
 * Equivalente a `buscarParcelasCandidatas` (useMapeamentoParcelas.ts do jotaCaixa), mas sem
 * a lógica de excedente/redistribuição de lá -- aqui só sugere parcelas cujo restante cobre
 * o valor exato da transação (a decisão de exigir cobertura exata é do
 * VincularTransacaoParcelaUseCase, não daqui; aqui só ordena por compatibilidade).
 */
@Injectable()
export class BuscarParcelasCandidatasUseCase {
  constructor(
    @Inject(CONCILIACAO_REPOSITORIO) private readonly conciliacao: ConciliacaoRepositorioPort,
    @Inject(CONTAS_PAGAR_REPOSITORIO) private readonly contasPagar: ContasPagarRepositorioPort,
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly contasReceber: ContasReceberRepositorioPort,
  ) {}

  async executar(transacaoId: string, empresaId: string): Promise<ParcelaCandidata[]> {
    const transacao = await this.conciliacao.obterTransacao(transacaoId);
    if (!transacao || transacao.empresaId !== empresaId) {
      throw new NotFoundException('Transação não encontrada');
    }

    const dataTransacaoMs = new Date(`${transacao.dataCompetencia}T00:00:00`).getTime();
    const candidatos: ParcelaCandidata[] = [];

    if (transacao.tipo === 'Saida') {
      const contas = await this.contasPagar.listarPorEmpresa(empresaId);
      for (const conta of contas) {
        for (const parcela of conta.parcelas) {
          if (parcela.status !== 'aberta' && parcela.status !== 'parcial') continue;
          const restante = Math.round((parcela.valorParcela - parcela.valorPago) * 100) / 100;
          if (restante <= 0) continue;
          candidatos.push({
            parcelaId: parcela.id,
            tipo: 'CP',
            descricao: `${conta.fornecedor} — ${conta.descricao}`,
            numeroParcela: parcela.numeroParcela,
            valorParcela: parcela.valorParcela,
            valorRestante: restante,
            dataVencimento: parcela.dataVencimento,
            compatibilidade: this.calcularCompatibilidade(transacao.valor, restante, dataTransacaoMs, parcela.dataVencimento),
          });
        }
      }
    } else {
      const contas = await this.contasReceber.listarPorEmpresa(empresaId);
      for (const conta of contas) {
        for (const parcela of conta.parcelas) {
          if (parcela.status !== 'aberta' && parcela.status !== 'parcial') continue;
          const restante = Math.round((parcela.valorParcela - parcela.valorRecebido) * 100) / 100;
          if (restante <= 0) continue;
          candidatos.push({
            parcelaId: parcela.id,
            tipo: 'CR',
            descricao: `${conta.clienteNome} — ${conta.descricao}`,
            numeroParcela: parcela.numeroParcela,
            valorParcela: parcela.valorParcela,
            valorRestante: restante,
            dataVencimento: parcela.dataVencimento,
            compatibilidade: this.calcularCompatibilidade(transacao.valor, restante, dataTransacaoMs, parcela.dataVencimento),
          });
        }
      }
    }

    const pesoCompatibilidade = { alta: 0, media: 1, baixa: 2 };
    return candidatos
      .sort(
        (a, b) =>
          pesoCompatibilidade[a.compatibilidade] - pesoCompatibilidade[b.compatibilidade] ||
          Math.abs(a.valorRestante - transacao.valor) - Math.abs(b.valorRestante - transacao.valor),
      )
      .slice(0, 10);
  }

  private calcularCompatibilidade(
    valorTransacao: number,
    restante: number,
    dataTransacaoMs: number,
    dataVencimento: string,
  ): 'alta' | 'media' | 'baixa' {
    const diferencaValor = Math.abs(restante - valorTransacao);
    const diasDiferenca = Math.abs(dataTransacaoMs - new Date(`${dataVencimento}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24);

    if (diferencaValor < 0.01 && diasDiferenca <= JANELA_DIAS) return 'alta';
    if (diferencaValor < 0.01 || diasDiferenca <= JANELA_DIAS) return 'media';
    return 'baixa';
  }
}
