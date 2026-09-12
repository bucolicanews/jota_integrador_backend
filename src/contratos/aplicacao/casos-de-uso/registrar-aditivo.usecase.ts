import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CancelarContaReceberUseCase } from '../../../contas-a-receber/aplicacao/casos-de-uso/cancelar-conta-receber.usecase';
import { CriarContaReceberUseCase } from '../../../contas-a-receber/aplicacao/casos-de-uso/criar-conta-receber.usecase';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort } from '../../../contas-a-receber/aplicacao/portas/contas-receber-repositorio.port';
import { ModoParcelamento } from '../../../contas-a-receber/dominio/conta-receber';
import { CONTRATOS_REPOSITORIO, ContratoAditivo, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

export interface DadosMudancaFinanceiraAditivo {
  valorTotalNovo: number;
  modo: ModoParcelamento;
  quantidadeParcelas: number;
  primeiroVencimento: string;
  intervaloDias: number;
}

export interface DadosRegistrarAditivo {
  contratoId: string;
  empresaId: string;
  descricao: string;
  mudancaFinanceira: DadosMudancaFinanceiraAditivo | null; // null = aditivo só documenta mudança não-financeira (prazo, cláusula)
  criadoPor: string;
}

/**
 * Não recalcula parcelas via motor genérico -- reaproveita 100% os primitivos já
 * existentes de Contas a Receber: cancela a conta antiga (CancelarContaReceberUseCase --
 * propaga o erro natural se já tiver recebimento, o que é o comportamento correto: não
 * dá pra trocar valor de contrato já parcialmente pago) + cria uma nova, linkando os
 * dois ids no aditivo pra preservar o histórico. Nunca edita parcela já paga.
 */
@Injectable()
export class RegistrarAditivoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly contasReceber: ContasReceberRepositorioPort,
    private readonly cancelarContaReceber: CancelarContaReceberUseCase,
    private readonly criarContaReceber: CriarContaReceberUseCase,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosRegistrarAditivo): Promise<ContratoAditivo> {
    const contrato = await this.repositorio.obterContratoPorId(dados.contratoId);
    if (!contrato || contrato.empresaId !== dados.empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }

    let contaReceberAnteriorId: string | null = null;
    let contaReceberNovaId: string | null = null;

    if (dados.mudancaFinanceira) {
      if (contrato.contaReceberId) {
        const contaAnterior = await this.contasReceber.obterPorId(contrato.contaReceberId);
        if (!contaAnterior) {
          throw new NotFoundException('Conta a receber vinculada ao contrato não encontrada');
        }
        await this.cancelarContaReceber.executar(contrato.contaReceberId, dados.empresaId, dados.criadoPor);
        contaReceberAnteriorId = contrato.contaReceberId;

        contaReceberNovaId = await this.criarContaReceber.executar({
          empresaId: dados.empresaId,
          clienteId: contrato.clienteId,
          clienteNome: contaAnterior.clienteNome,
          descricao: `Aditivo: ${dados.descricao}`,
          contaPatrimonialId: contaAnterior.contaPatrimonialId,
          contaResultadoId: contaAnterior.contaResultadoId,
          dataEmissao: new Date().toISOString().slice(0, 10),
          criadoPor: dados.criadoPor,
          modo: dados.mudancaFinanceira.modo,
          valor: dados.mudancaFinanceira.valorTotalNovo,
          quantidadeParcelas: dados.mudancaFinanceira.quantidadeParcelas,
          primeiroVencimento: dados.mudancaFinanceira.primeiroVencimento,
          intervaloDias: dados.mudancaFinanceira.intervaloDias,
        });

        await this.repositorio.atualizarContrato(contrato.id, {
          valorTotal: dados.mudancaFinanceira.valorTotalNovo,
          contaReceberId: contaReceberNovaId,
        });
      }
    }

    const aditivo = await this.repositorio.criarAditivo({
      contratoId: dados.contratoId,
      descricao: dados.descricao,
      valorTotalNovo: dados.mudancaFinanceira?.valorTotalNovo ?? null,
      numeroParcelasNovo: dados.mudancaFinanceira?.quantidadeParcelas ?? null,
      contaReceberAnteriorId,
      contaReceberNovaId,
      criadoPor: dados.criadoPor,
    });

    await this.auditoria.registrar({
      usuarioId: dados.criadoPor,
      empresaId: dados.empresaId,
      acao: 'REGISTRAR_ADITIVO_CONTRATO',
      recurso: `contratos:${dados.contratoId}`,
      dadosNovos: { descricao: dados.descricao, contaReceberAnteriorId, contaReceberNovaId },
    });

    return aditivo;
  }
}
