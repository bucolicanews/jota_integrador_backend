import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RegistrarPagamentoUseCase } from '../../../contas-a-pagar/aplicacao/casos-de-uso/registrar-pagamento.usecase';
import { RegistrarRecebimentoUseCase } from '../../../contas-a-receber/aplicacao/casos-de-uso/registrar-recebimento.usecase';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort } from '../portas/conciliacao-repositorio.port';

export interface DadosVincularParcela {
  transacaoId: string;
  empresaId: string;
  usuarioId: string;
  parcelaId: string;
  tipo: 'CP' | 'CR';
}

export interface ResultadoVinculo {
  lancamentoId: string;
}

/**
 * Equivalente ao "Mapear Agora" do jotaCaixa (fluxo primário de Conciliacao.tsx), mas
 * simplificado: exige que a parcela cubra o valor EXATO da transação (nunca parcial nem
 * excedente) -- o modelo de dados daqui (1 transação de conciliação = no máximo 1
 * lançamento) não tem onde guardar "sobra" ou "restante ainda não vinculado" como o
 * jotaCaixa tinha (`extrato_parcela_vinculo` + `conciliacao_lancamentos_avulsos`,
 * a origem dos bugs de excedente documentados na memória do projeto). Se a parcela não
 * cobrir exatamente, o usuário escolhe outra parcela ou cai pra categorização direta.
 */
@Injectable()
export class VincularTransacaoParcelaUseCase {
  constructor(
    @Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort,
    private readonly registrarPagamento: RegistrarPagamentoUseCase,
    private readonly registrarRecebimento: RegistrarRecebimentoUseCase,
  ) {}

  async executar(dados: DadosVincularParcela): Promise<ResultadoVinculo> {
    const transacao = await this.repositorio.obterTransacao(dados.transacaoId);
    if (!transacao || transacao.empresaId !== dados.empresaId) {
      throw new NotFoundException('Transação não encontrada');
    }
    if (transacao.status !== 'pendente') {
      throw new BadRequestException(`Transação já está com status "${transacao.status}"`);
    }

    const tipoEsperado = transacao.tipo === 'Saida' ? 'CP' : 'CR';
    if (dados.tipo !== tipoEsperado) {
      throw new BadRequestException(
        `Transação de ${transacao.tipo} só pode ser vinculada a parcela de ${tipoEsperado === 'CP' ? 'Contas a Pagar' : 'Contas a Receber'}`,
      );
    }

    const lancamentoId =
      dados.tipo === 'CP'
        ? (
            await this.registrarPagamento.executar({
              parcelaId: dados.parcelaId,
              empresaId: dados.empresaId,
              contaBancariaId: transacao.contaContabilId,
              valorPago: transacao.valor,
              dataPagamento: transacao.dataCompetencia,
              usuarioId: dados.usuarioId,
            })
          ).lancamentoId
        : (
            await this.registrarRecebimento.executar({
              parcelaId: dados.parcelaId,
              empresaId: dados.empresaId,
              contaBancariaId: transacao.contaContabilId,
              valorRecebido: transacao.valor,
              dataRecebimento: transacao.dataCompetencia,
              usuarioId: dados.usuarioId,
            })
          ).lancamentoId;

    await this.repositorio.marcarConciliada(transacao.id, lancamentoId);

    return { lancamentoId };
  }
}
