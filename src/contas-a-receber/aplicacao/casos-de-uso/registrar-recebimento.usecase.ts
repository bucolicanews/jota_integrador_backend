import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort, RecebimentoContaReceber } from '../portas/contas-receber-repositorio.port';

export interface DadosRegistrarRecebimento {
  parcelaId: string;
  empresaId: string;
  contaBancariaId: string;
  valorRecebido: number;
  dataRecebimento: string;
  usuarioId: string;
}

/** Baixa do direito: D Caixa-Banco / C Ativo(a receber). Cria o lançamento ANTES de persistir o recebimento -- mesmo motivo de RegistrarPagamentoUseCase (contas-a-pagar). */
@Injectable()
export class RegistrarRecebimentoUseCase {
  constructor(
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly repositorio: ContasReceberRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosRegistrarRecebimento): Promise<RecebimentoContaReceber> {
    if (dados.valorRecebido <= 0) throw new BadRequestException('Valor do recebimento precisa ser maior que zero');

    const parcela = await this.repositorio.obterParcela(dados.parcelaId);
    if (!parcela || parcela.empresaId !== dados.empresaId) {
      throw new NotFoundException('Parcela não encontrada');
    }
    if (parcela.status === 'cancelada') {
      throw new BadRequestException('Parcela cancelada não pode receber recebimento');
    }
    if (parcela.status === 'recebida') {
      throw new BadRequestException('Parcela já está totalmente recebida');
    }

    const restante = Math.round((parcela.valorParcela - parcela.valorRecebido) * 100) / 100;
    if (dados.valorRecebido > restante) {
      throw new BadRequestException(`Valor excede o restante da parcela (R$ ${restante.toFixed(2)})`);
    }

    const conta = await this.repositorio.obterPorId(parcela.contaReceberId);
    if (!conta) throw new NotFoundException('Conta a receber não encontrada');

    const contaBancaria = await this.planoContas.buscarPorId(dados.contaBancariaId);
    if (!contaBancaria || contaBancaria.empresaId !== dados.empresaId) {
      throw new NotFoundException('Conta bancária não encontrada');
    }
    if (!contaBancaria.contaCaixaBanco) {
      throw new BadRequestException('A conta selecionada não está marcada como Caixa/Banco no plano de contas');
    }

    const lancamentoId = await this.lancamentos.criar({
      empresaId: dados.empresaId,
      dataCompetencia: dados.dataRecebimento,
      historico: `Recebimento: ${conta.descricao} (${conta.clienteNome}) -- parcela ${parcela.numeroParcela}`,
      documentoReferencia: parcela.id,
      origem: 'contas_a_receber',
      partidas: [
        { contaId: dados.contaBancariaId, tipo: 'debito', valor: dados.valorRecebido },
        { contaId: conta.contaPatrimonialId, tipo: 'credito', valor: dados.valorRecebido },
      ],
      criadoPor: dados.usuarioId,
    });

    const recebimento = await this.repositorio.criarRecebimento({
      parcelaId: dados.parcelaId,
      empresaId: dados.empresaId,
      contaBancariaId: dados.contaBancariaId,
      valorRecebido: dados.valorRecebido,
      dataRecebimento: dados.dataRecebimento,
      lancamentoId,
      criadoPor: dados.usuarioId,
    });

    await this.auditoria.registrar({
      usuarioId: dados.usuarioId,
      empresaId: dados.empresaId,
      acao: 'REGISTRAR_RECEBIMENTO_CONTA_RECEBER',
      recurso: `parcelas_contas_receber:${parcela.id}`,
      dadosNovos: { valorRecebido: dados.valorRecebido, lancamentoId },
    });

    return recebimento;
  }
}
