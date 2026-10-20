import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { StorageDasService } from '../../infraestrutura/storage-das.service';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';
import { SincronizarDasEmpresaUseCase } from './sincronizar-das-empresa.usecase';

/**
 * "Baixar" e "2ª via" são a MESMA ação aqui: o PDF já fica cacheado no Storage desde a
 * sincronização, então re-gerar a signed URL não chama o SERPRO nem gasta crédito novo.
 * Só no caso raro de um item nunca ter sido sincronizado com sucesso (pdfStorageRef
 * ainda nulo) é que esse usecase dispara uma sincronização pontual antes de responder.
 */
@Injectable()
export class ObterUrlPdfDasUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
    private readonly storage: StorageDasService,
    private readonly sincronizarDasEmpresa: SincronizarDasEmpresaUseCase,
  ) {}

  async executar(empresaId: string, dasId: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }
    if (empresa.regimeTributario !== 'mei' && empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('Módulo de DAS só se aplica a empresas MEI ou Simples Nacional ME/EPP');
    }
    const regime = empresa.regimeTributario;

    let item = await this.dasRepositorio.buscarPorId(dasId, regime);
    if (!item || item.empresaId !== empresaId) {
      throw new NotFoundException('DAS não encontrado');
    }

    if (!item.pdfStorageRef) {
      await this.sincronizarDasEmpresa.executar(empresaId);
      item = await this.dasRepositorio.buscarPorId(dasId, regime);
      if (!item?.pdfStorageRef) {
        throw new NotFoundException('PDF deste DAS ainda não está disponível -- tente sincronizar novamente em alguns instantes');
      }
    }

    return this.storage.gerarUrlAssinada(item.pdfStorageRef);
  }
}
