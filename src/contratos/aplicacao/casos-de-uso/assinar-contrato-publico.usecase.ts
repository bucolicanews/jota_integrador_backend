import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { podeAssinar } from '../../dominio/contrato';
import { StorageContratosService } from '../../infraestrutura/storage-contratos.service';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

export interface DadosAssinarContratoPublico {
  token: string;
  nome: string;
  selfie: { nomeOriginal: string; buffer: Buffer; contentType: string };
}

/**
 * Endpoint público (sem usuário autenticado) -- usuarioId vai null no log de auditoria
 * (logs_auditoria.usuario_id é nullable, ver AuditoriaService.RegistroAuditoria). Nunca
 * usa nenhum id de contador/dono aqui, seria falsificar quem realmente agiu.
 */
@Injectable()
export class AssinarContratoPublicoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    private readonly storage: StorageContratosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosAssinarContratoPublico): Promise<void> {
    const contrato = await this.repositorio.obterContratoPorToken(dados.token);
    if (!contrato) {
      throw new NotFoundException('Contrato não encontrado');
    }
    if (!podeAssinar(contrato.status)) {
      throw new BadRequestException(`Contrato com status "${contrato.status}" não pode ser assinado`);
    }
    if (!dados.nome.trim()) {
      throw new BadRequestException('Nome é obrigatório para assinar');
    }

    const ref = await this.storage.armazenar(contrato.empresaId, contrato.id, dados.selfie.nomeOriginal, dados.selfie.buffer, dados.selfie.contentType);

    await this.repositorio.registrarAssinatura(contrato.id, { assinaturaNome: dados.nome.trim(), assinaturaSelfieRef: ref });

    await this.auditoria.registrar({
      usuarioId: null,
      empresaId: contrato.empresaId,
      acao: 'ASSINAR_CONTRATO_PUBLICO',
      recurso: `contratos:${contrato.id}`,
      dadosNovos: { assinaturaNome: dados.nome.trim() },
    });
  }
}
