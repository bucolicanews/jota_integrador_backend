import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { podeBloquear } from '../../dominio/contrato';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

@Injectable()
export class BloquearContratoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, usuarioId: string): Promise<void> {
    const contrato = await this.repositorio.obterContratoPorId(id);
    if (!contrato || contrato.empresaId !== empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }
    if (!podeBloquear(contrato.status)) {
      throw new BadRequestException(`Contrato com status "${contrato.status}" não pode ser bloqueado`);
    }

    await this.repositorio.marcarStatus(id, 'bloqueado');

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'BLOQUEAR_CONTRATO',
      recurso: `contratos:${id}`,
      dadosAntigos: { status: contrato.status },
    });
  }
}
