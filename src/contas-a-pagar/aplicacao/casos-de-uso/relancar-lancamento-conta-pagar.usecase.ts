import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { CONTAS_PAGAR_REPOSITORIO, ContasPagarRepositorioPort } from '../portas/contas-pagar-repositorio.port';

/** Simétrico a RelancarLancamentoContaReceberUseCase -- recria o lançamento de competência (D resultado/C patrimonial) de uma conta a pagar sem lançamento ativo. */
@Injectable()
export class RelancarLancamentoContaPagarUseCase {
  constructor(
    @Inject(CONTAS_PAGAR_REPOSITORIO) private readonly repositorio: ContasPagarRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(contaPagarId: string, empresaId: string, executadoPor: string): Promise<string> {
    const conta = await this.repositorio.obterPorId(contaPagarId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta a pagar não encontrada');
    }
    if (conta.cancelada) {
      throw new BadRequestException('Conta a pagar cancelada não recebe lançamento novo');
    }
    if (conta.temLancamentoAtivo) {
      throw new BadRequestException('Esta conta já tem um lançamento de competência ativo');
    }

    const lancamentoId = await this.lancamentos.criar({
      empresaId,
      dataCompetencia: new Date().toISOString().slice(0, 10),
      historico: `Competência (relançado): ${conta.descricao} (${conta.fornecedor})`,
      documentoReferencia: contaPagarId,
      origem: 'contas_a_pagar',
      partidas: [
        { contaId: conta.contaResultadoId, tipo: 'debito', valor: conta.valorTotal },
        { contaId: conta.contaPatrimonialId, tipo: 'credito', valor: conta.valorTotal },
      ],
      criadoPor: executadoPor,
    });

    await this.auditoria.registrar({
      usuarioId: executadoPor,
      empresaId,
      acao: 'RELANCAR_LANCAMENTO_CONTA_PAGAR',
      recurso: `contas_pagar:${contaPagarId}`,
      dadosNovos: { lancamentoId },
    });

    return lancamentoId;
  }
}
