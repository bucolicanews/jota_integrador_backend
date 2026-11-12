import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { DasItem } from '../../dominio/das';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';

/** Tela de Pendências do DAS -- DAS já "pago" (confirmado pelo sync) mas sem baixa contábil ainda, porque ela exige escolher caixa/banco (nunca automática). */
@Injectable()
export class ListarDasPendentesBaixaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<DasItem[]> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }
    if (empresa.regimeTributario !== 'mei' && empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('Módulo de DAS só se aplica a empresas MEI ou Simples Nacional ME/EPP');
    }
    return this.dasRepositorio.listarPendentesDeBaixa(empresaId, empresa.regimeTributario);
  }
}
