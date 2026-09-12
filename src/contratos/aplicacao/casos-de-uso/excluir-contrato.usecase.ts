import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort } from '../../../contas-a-receber/aplicacao/portas/contas-receber-repositorio.port';
import { podeExcluir } from '../../dominio/contrato';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

@Injectable()
export class ExcluirContratoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly contasReceber: ContasReceberRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, usuarioId: string): Promise<void> {
    const contrato = await this.repositorio.obterContratoPorId(id);
    if (!contrato || contrato.empresaId !== empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }
    if (!podeExcluir(contrato.status)) {
      throw new BadRequestException('Só é possível excluir um contrato em rascunho ou pendente de assinatura');
    }

    if (contrato.contaReceberId) {
      const conta = await this.contasReceber.obterPorId(contrato.contaReceberId);
      if (conta && conta.valorRecebido > 0) {
        throw new BadRequestException('Contrato já tem recebimento registrado -- estorne antes de excluir');
      }
    }

    await this.repositorio.excluirContrato(id);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'EXCLUIR_CONTRATO',
      recurso: `contratos:${id}`,
      dadosAntigos: { titulo: contrato.titulo, clienteId: contrato.clienteId },
    });
  }
}
