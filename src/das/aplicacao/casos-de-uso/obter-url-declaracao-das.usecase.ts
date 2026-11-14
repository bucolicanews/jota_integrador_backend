import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { StorageDasService } from '../../infraestrutura/storage-das.service';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';

/**
 * Declaração (Programa Gerador do DAS -- Declaratório) só existe pra Simples Nacional.
 * Mesmo padrão de ObterUrlReciboDasUseCase -- cacheada no sync (CONSDECREC15, mesma
 * chamada que já busca o recibo), nunca gera na hora.
 */
@Injectable()
export class ObterUrlDeclaracaoDasUseCase {
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
      throw new BadRequestException('Declaração só se aplica a empresas Simples Nacional ME/EPP');
    }

    const item = await this.dasRepositorio.buscarPorId(dasId, 'simples_nacional');
    if (!item || item.empresaId !== empresaId) {
      throw new NotFoundException('DAS não encontrado');
    }
    if (!item.declaracaoStorageRef) {
      throw new NotFoundException('Declaração desta competência ainda não está disponível');
    }

    return this.storage.gerarUrlAssinada(item.declaracaoStorageRef);
  }
}
