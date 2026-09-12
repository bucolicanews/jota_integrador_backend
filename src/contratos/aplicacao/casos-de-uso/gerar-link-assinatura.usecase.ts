import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { podeGerarLinkAssinatura } from '../../dominio/contrato';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

/** Gerar o link também transiciona rascunho -> pendente_assinatura (é o que destrava AssinarContratoPublicoUseCase, que só aceita contrato já pendente_assinatura). */
@Injectable()
export class GerarLinkAssinaturaUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<{ url: string }> {
    const contrato = await this.repositorio.obterContratoPorId(id);
    if (!contrato || contrato.empresaId !== empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }
    if (!podeGerarLinkAssinatura(contrato.status)) {
      throw new BadRequestException(`Contrato com status "${contrato.status}" não aceita novo link de assinatura`);
    }

    if (contrato.status === 'rascunho') {
      await this.repositorio.marcarStatus(id, 'pendente_assinatura');
    }

    const configuracao = await this.repositorio.obterConfiguracao(empresaId);
    const base = configuracao?.urlBaseAssinatura || '';
    return { url: `${base}/assinar-contrato/${contrato.tokenAssinatura}` };
  }
}
