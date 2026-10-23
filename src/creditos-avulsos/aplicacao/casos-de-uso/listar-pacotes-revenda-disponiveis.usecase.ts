import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO,
  PlanosRevendaCreditosAvulsosRepositorioPort,
} from '../../../planos-revenda-creditos-avulsos/aplicacao/portas/planos-revenda-creditos-avulsos-repositorio.port';
import { PACOTES_CREDITOS_AVULSOS_REPOSITORIO, PacotesCreditosAvulsosRepositorioPort } from '../portas/pacotes-creditos-avulsos-repositorio.port';

export interface PacoteRevendaDisponivel {
  planoRevendaId: string;
  nome: string;
  quantidadeCreditos: number;
  valorVenda: number;
}

/** Catálogo de pacotes de revenda ATIVOS do contador dono da empresa -- pra ela escolher o que comprar DELE (com split), em vez do pacote direto da plataforma. */
@Injectable()
export class ListarPacotesRevendaDisponiveisUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO) private readonly planosRevendaRepositorio: PlanosRevendaCreditosAvulsosRepositorioPort,
    @Inject(PACOTES_CREDITOS_AVULSOS_REPOSITORIO) private readonly pacotesRepositorio: PacotesCreditosAvulsosRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<PacoteRevendaDisponivel[]> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const planos = await this.planosRevendaRepositorio.listarPorContador(empresa.contadorId);
    const resultado: PacoteRevendaDisponivel[] = [];
    for (const plano of planos.filter((p) => p.ativo)) {
      const pacote = await this.pacotesRepositorio.buscarPorId(plano.pacoteId);
      if (!pacote || !pacote.ativo) continue; // pacote-base descontinuado -- não oferece mais, mesmo com plano de revenda ainda ativo
      resultado.push({
        planoRevendaId: plano.id,
        nome: plano.nome ?? pacote.nome,
        quantidadeCreditos: pacote.quantidadeCreditos,
        valorVenda: plano.valorVenda,
      });
    }
    return resultado;
  }
}
