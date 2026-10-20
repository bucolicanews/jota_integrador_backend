import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { DasItem, StatusApresentacaoDas, statusApresentacao } from '../../dominio/das';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';

export type DasListado = DasItem & { statusApresentacao: StatusApresentacaoDas };

@Injectable()
export class ListarDasUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<DasListado[]> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }
    if (empresa.regimeTributario !== 'mei' && empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('Módulo de DAS só se aplica a empresas MEI ou Simples Nacional ME/EPP');
    }

    const regime = empresa.regimeTributario;
    const itens = await this.dasRepositorio.listarPorEmpresa(empresaId, regime);
    const hoje = new Date();
    return itens.map((item) => ({ ...item, statusApresentacao: statusApresentacao(item, hoje) }));
  }
}
