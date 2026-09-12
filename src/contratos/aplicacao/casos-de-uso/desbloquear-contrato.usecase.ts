import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { podeDesbloquear } from '../../dominio/contrato';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

@Injectable()
export class DesbloquearContratoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, usuarioId: string): Promise<void> {
    const contrato = await this.repositorio.obterContratoPorId(id);
    if (!contrato || contrato.empresaId !== empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }
    if (!podeDesbloquear(contrato.status)) {
      throw new BadRequestException('Contrato não está bloqueado');
    }

    // Não guardamos "status antes de bloquear" -- volta pra 'ativo' se já foi assinado
    // (caso comum: bloqueio temporário de contrato em vigor), senão 'rascunho' (mais
    // seguro que assumir 'pendente_assinatura' sem saber se um link já tinha sido gerado).
    const statusRestaurado = contrato.assinadoEm ? 'ativo' : 'rascunho';
    await this.repositorio.marcarStatus(id, statusRestaurado);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'DESBLOQUEAR_CONTRATO',
      recurso: `contratos:${id}`,
      dadosNovos: { status: statusRestaurado },
    });
  }
}
