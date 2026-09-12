import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { CONTAS_PAGAR_REPOSITORIO, ContasPagarRepositorioPort, PagamentoContaPagar } from '../portas/contas-pagar-repositorio.port';

export interface DadosRegistrarPagamento {
  parcelaId: string;
  empresaId: string;
  contaBancariaId: string;
  valorPago: number;
  dataPagamento: string;
  usuarioId: string;
}

/** Baixa da obrigação: D Passivo / C Caixa-Banco. Cria o lançamento ANTES de persistir o pagamento -- se o lançamento falhar (partida não fecha, conta inválida), nenhum registro de pagamento órfão sem lançamento fica pra trás (exatamente a classe de falha que os scripts de restauração do jotaCaixa foram criados pra consertar depois). */
@Injectable()
export class RegistrarPagamentoUseCase {
  constructor(
    @Inject(CONTAS_PAGAR_REPOSITORIO) private readonly repositorio: ContasPagarRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosRegistrarPagamento): Promise<PagamentoContaPagar> {
    if (dados.valorPago <= 0) throw new BadRequestException('Valor do pagamento precisa ser maior que zero');

    const parcela = await this.repositorio.obterParcela(dados.parcelaId);
    if (!parcela || parcela.empresaId !== dados.empresaId) {
      throw new NotFoundException('Parcela não encontrada');
    }
    if (parcela.status === 'cancelada') {
      throw new BadRequestException('Parcela cancelada não pode receber pagamento');
    }
    if (parcela.status === 'paga') {
      throw new BadRequestException('Parcela já está totalmente paga');
    }

    const restante = Math.round((parcela.valorParcela - parcela.valorPago) * 100) / 100;
    if (dados.valorPago > restante) {
      throw new BadRequestException(`Valor excede o restante da parcela (R$ ${restante.toFixed(2)})`);
    }

    const conta = await this.repositorio.obterPorId(parcela.contaPagarId);
    if (!conta) throw new NotFoundException('Conta a pagar não encontrada');

    const contaBancaria = await this.planoContas.buscarPorId(dados.contaBancariaId);
    if (!contaBancaria || contaBancaria.empresaId !== dados.empresaId) {
      throw new NotFoundException('Conta bancária não encontrada');
    }
    if (!contaBancaria.contaCaixaBanco) {
      throw new BadRequestException('A conta selecionada não está marcada como Caixa/Banco no plano de contas');
    }

    const lancamentoId = await this.lancamentos.criar({
      empresaId: dados.empresaId,
      dataCompetencia: dados.dataPagamento,
      historico: `Pagamento: ${conta.descricao} (${conta.fornecedor}) -- parcela ${parcela.numeroParcela}`,
      documentoReferencia: parcela.id,
      origem: 'contas_a_pagar',
      partidas: [
        { contaId: conta.contaPatrimonialId, tipo: 'debito', valor: dados.valorPago },
        { contaId: dados.contaBancariaId, tipo: 'credito', valor: dados.valorPago },
      ],
      criadoPor: dados.usuarioId,
    });

    const pagamento = await this.repositorio.criarPagamento({
      parcelaId: dados.parcelaId,
      empresaId: dados.empresaId,
      contaBancariaId: dados.contaBancariaId,
      valorPago: dados.valorPago,
      dataPagamento: dados.dataPagamento,
      lancamentoId,
      criadoPor: dados.usuarioId,
    });

    await this.auditoria.registrar({
      usuarioId: dados.usuarioId,
      empresaId: dados.empresaId,
      acao: 'REGISTRAR_PAGAMENTO_CONTA_PAGAR',
      recurso: `parcelas_contas_pagar:${parcela.id}`,
      dadosNovos: { valorPago: dados.valorPago, lancamentoId },
    });

    return pagamento;
  }
}
