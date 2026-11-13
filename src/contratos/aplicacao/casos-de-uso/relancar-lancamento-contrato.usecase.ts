import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort } from '../../../contas-a-receber/aplicacao/portas/contas-receber-repositorio.port';
import { RelancarLancamentoContaReceberUseCase } from '../../../contas-a-receber/aplicacao/casos-de-uso/relancar-lancamento-conta-receber.usecase';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

/**
 * Antes de relançar, corrige as contas D/C da conta a receber pra bater com a
 * Configuração de Contratos ATUAL -- sem isso, o lançamento novo repetia a conta
 * antiga congelada na criação do contrato, mesmo depois do usuário corrigir a config
 * (bug real: trocou a conta de receita, relançou, lançamento saiu na conta velha).
 */
@Injectable()
export class RelancarLancamentoContratoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly contratos: ContratosRepositorioPort,
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly contasReceber: ContasReceberRepositorioPort,
    private readonly relancarContaReceber: RelancarLancamentoContaReceberUseCase,
  ) {}

  async executar(contratoId: string, empresaId: string, executadoPor: string): Promise<string> {
    const contrato = await this.contratos.obterContratoPorId(contratoId);
    if (!contrato || contrato.empresaId !== empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }
    if (!contrato.contaReceberId) {
      throw new BadRequestException('Este contrato não tem conta a receber vinculada');
    }

    const config = await this.contratos.obterConfiguracao(empresaId);
    if (!config?.contaPatrimonialReceberId || !config.contaResultadoReceitaId) {
      throw new BadRequestException('Configure as contas contábeis de contratos antes de relançar');
    }

    await this.contasReceber.atualizarContasContabeis(contrato.contaReceberId, config.contaPatrimonialReceberId, config.contaResultadoReceitaId);

    return this.relancarContaReceber.executar(contrato.contaReceberId, empresaId, executadoPor);
  }
}
