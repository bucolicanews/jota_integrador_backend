import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort } from '../portas/assinaturas-repositorio.port';

/** Suspende o acesso da empresa ao SERPRO sem apagar o vínculo/saldo -- contador pode desbloquear depois reativando (AtivarAssinaturaManualUseCase) ou pagando de novo. */
@Injectable()
export class BloquearAssinaturaUseCase {
  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly repositorio: AssinaturasRepositorioPort,
  ) {}

  async executar(contadorId: string, empresaId: string): Promise<void> {
    const assinatura = await this.repositorio.buscarPorEmpresa(empresaId);
    if (!assinatura || assinatura.contadorId !== contadorId) {
      throw new NotFoundException('Assinatura não encontrada');
    }
    if (assinatura.status !== 'ativa') {
      throw new BadRequestException('Assinatura não está ativa');
    }
    await this.repositorio.atualizarStatus(assinatura.id, 'bloqueada');
  }
}
