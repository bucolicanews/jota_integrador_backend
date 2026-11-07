import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSOES_REPOSITORIO, PermissoesRepositorioPort } from '../../../auth/aplicacao/portas/permissoes-repositorio.port';
import { validarDadosPlano } from '../../dominio/plano';
import {
  DadosAtualizacaoPlano,
  PLANOS_REPOSITORIO,
  Plano,
  PlanosRepositorioPort,
} from '../portas/planos-repositorio.port';

@Injectable()
export class AtualizarPlanoUseCase {
  constructor(
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoesRepositorio: PermissoesRepositorioPort,
  ) {}

  async executar(id: string, dados: DadosAtualizacaoPlano): Promise<Plano> {
    const existente = await this.planosRepositorio.buscarPorId(id);
    if (!existente) {
      throw new NotFoundException('Plano não encontrado');
    }

    try {
      validarDadosPlano(dados.preco ?? existente.preco, dados.gratuito ?? existente.gratuito, dados.modulos ?? existente.modulos);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    if (dados.permissoesPadrao && dados.permissoesPadrao.length > 0) {
      const catalogo = await this.permissoesRepositorio.listarCatalogoPermissoes();
      const chavesValidas = new Set(catalogo.map((p) => p.chave));
      const invalida = dados.permissoesPadrao.find((chave) => !chavesValidas.has(chave));
      if (invalida) {
        throw new BadRequestException(`Permissão "${invalida}" não existe no catálogo`);
      }
    }

    return this.planosRepositorio.atualizar(id, dados);
  }
}
