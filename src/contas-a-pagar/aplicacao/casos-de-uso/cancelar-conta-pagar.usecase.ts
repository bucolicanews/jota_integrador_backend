import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CONTAS_PAGAR_REPOSITORIO, ContasPagarRepositorioPort } from '../portas/contas-pagar-repositorio.port';

/** Cancelar (nunca excluir -- mesmo princípio de sempre). Bloqueado se já tem pagamento, pra não perder rastro de dinheiro que já saiu -- estornar o pagamento primeiro. */
@Injectable()
export class CancelarContaPagarUseCase {
  constructor(
    @Inject(CONTAS_PAGAR_REPOSITORIO) private readonly repositorio: ContasPagarRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, usuarioId: string): Promise<void> {
    const conta = await this.repositorio.obterPorId(id);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta a pagar não encontrada');
    }
    if (conta.valorPago > 0) {
      throw new BadRequestException('Conta já tem pagamento registrado -- estorne o(s) pagamento(s) antes de cancelar');
    }

    await this.repositorio.cancelar(id);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'CANCELAR_CONTA_PAGAR',
      recurso: `contas_pagar:${id}`,
      dadosAntigos: { fornecedor: conta.fornecedor, valorTotal: conta.valorTotal },
    });
  }
}
