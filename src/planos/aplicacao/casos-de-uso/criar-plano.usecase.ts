import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PERMISSOES_REPOSITORIO, PermissoesRepositorioPort } from '../../../auth/aplicacao/portas/permissoes-repositorio.port';
import { validarDadosPlano } from '../../dominio/plano';
import { DadosNovoPlano, PLANOS_REPOSITORIO, Plano, PlanosRepositorioPort } from '../portas/planos-repositorio.port';

@Injectable()
export class CriarPlanoUseCase {
  constructor(
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
    @Inject(PERMISSOES_REPOSITORIO) private readonly permissoesRepositorio: PermissoesRepositorioPort,
  ) {}

  async executar(dados: DadosNovoPlano): Promise<Plano> {
    try {
      validarDadosPlano(dados.preco, dados.gratuito, dados.modulos);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }

    if (dados.permissoesPadrao.length > 0) {
      const catalogo = await this.permissoesRepositorio.listarCatalogoPermissoes();
      const chavesValidas = new Set(catalogo.map((p) => p.chave));
      const invalida = dados.permissoesPadrao.find((chave) => !chavesValidas.has(chave));
      if (invalida) {
        throw new BadRequestException(`Permissão "${invalida}" não existe no catálogo`);
      }
    }

    return this.planosRepositorio.criar(dados);
  }
}
