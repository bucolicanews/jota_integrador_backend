import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { StorageDasService } from '../../infraestrutura/storage-das.service';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';

/**
 * Recibo (CONSDECREC15) só existe pra Simples Nacional (declaração PGDASD) -- MEI não
 * declara, só gera o DAS direto (PGMEI). Diferente de ObterUrlPdfDasUseCase, nunca
 * dispara sync pontual se faltar: o recibo é melhor esforço no próprio sync (ver
 * SincronizarDasEmpresaUseCase) -- se não veio, a causa mais provável é o SERPRO não ter
 * devolvido numeroDeclaracao ou o shape nunca confirmado de CONSDECREC15, não "ainda não
 * sincronizou".
 */
@Injectable()
export class ObterUrlReciboDasUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
    private readonly storage: StorageDasService,
  ) {}

  async executar(empresaId: string, dasId: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }
    if (empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('Recibo de entrega da declaração só se aplica a empresas Simples Nacional ME/EPP');
    }

    const item = await this.dasRepositorio.buscarPorId(dasId, 'simples_nacional');
    if (!item || item.empresaId !== empresaId) {
      throw new NotFoundException('DAS não encontrado');
    }
    if (!item.reciboStorageRef) {
      throw new NotFoundException('Recibo desta competência ainda não está disponível');
    }

    return this.storage.gerarUrlAssinada(item.reciboStorageRef);
  }
}
