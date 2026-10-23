import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  PLANOS_REVENDA_CREDITOS_REPOSITORIO,
  PlanosRevendaCreditosRepositorioPort,
} from '../../../planos-revenda-creditos/aplicacao/portas/planos-revenda-creditos-repositorio.port';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../../../planos/aplicacao/portas/planos-repositorio.port';

export interface PlanoRevendaDisponivelAssinatura {
  planoRevendaId: string;
  nome: string;
  valorVenda: number;
  periodicidade: string;
}

/** Catálogo de planos de revenda ATIVOS do contador dono da empresa -- pra ela assinar DELE (com split) por conta própria, sem esperar o contador iniciar a cobrança. */
@Injectable()
export class ListarPlanosRevendaDisponiveisUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PLANOS_REVENDA_CREDITOS_REPOSITORIO) private readonly planosRevendaRepositorio: PlanosRevendaCreditosRepositorioPort,
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<PlanoRevendaDisponivelAssinatura[]> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const planos = await this.planosRevendaRepositorio.listarPorContador(empresa.contadorId);
    const resultado: PlanoRevendaDisponivelAssinatura[] = [];
    for (const planoRevenda of planos.filter((p) => p.ativo)) {
      const plano = await this.planosRepositorio.buscarPorId(planoRevenda.planoId);
      if (!plano || !plano.ativo) continue; // plano-base descontinuado -- não oferece mais, mesmo com plano de revenda ainda ativo
      resultado.push({
        planoRevendaId: planoRevenda.id,
        nome: planoRevenda.nome ?? plano.nome,
        valorVenda: planoRevenda.valorVenda,
        periodicidade: plano.periodicidade,
      });
    }
    return resultado;
  }
}
