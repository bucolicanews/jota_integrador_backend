import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { podeEditarConteudo } from '../../dominio/contrato';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort, DadosAtualizarContrato } from '../portas/contratos-repositorio.port';

@Injectable()
export class AtualizarContratoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, dados: DadosAtualizarContrato, usuarioId: string): Promise<void> {
    const contrato = await this.repositorio.obterContratoPorId(id);
    if (!contrato || contrato.empresaId !== empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }
    if (!podeEditarConteudo(contrato.status)) {
      throw new BadRequestException('Só é possível editar um contrato em rascunho ou pendente de assinatura');
    }

    await this.repositorio.atualizarContrato(id, dados);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'ATUALIZAR_CONTRATO',
      recurso: `contratos:${id}`,
      dadosAntigos: { titulo: contrato.titulo },
      dadosNovos: dados,
    });
  }
}
