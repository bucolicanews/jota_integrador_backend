import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort } from '../portas/assinaturas-repositorio.port';

/**
 * Cancela de vez o vínculo plano↔empresa (diferente de BloquearAssinaturaUseCase, que só
 * suspende temporariamente). Libera o índice único "1 assinatura não-cancelada por
 * empresa" -- depois de cancelar, AtivarAssinaturaManualUseCase/IniciarPagamentoAssinatura
 * criam uma NOVA assinatura do zero pra essa empresa, não reaproveitam a cancelada.
 * Saldo de créditos não é apagado -- só o vínculo com o plano.
 */
@Injectable()
export class CancelarAssinaturaCreditoUseCase {
  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly repositorio: AssinaturasRepositorioPort,
  ) {}

  async executar(contadorId: string, empresaId: string): Promise<void> {
    const assinatura = await this.repositorio.buscarPorEmpresa(empresaId);
    if (!assinatura || assinatura.contadorId !== contadorId) {
      throw new NotFoundException('Assinatura não encontrada');
    }
    await this.repositorio.atualizarStatus(assinatura.id, 'cancelada');
  }
}
