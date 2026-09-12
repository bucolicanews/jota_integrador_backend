import { Inject, Injectable } from '@nestjs/common';
import { TAGS_SISTEMA } from '../../dominio/contrato';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

export interface TagCatalogo {
  nome: string;
  origem: 'sistema' | 'customizada';
  descricao: string | null;
}

@Injectable()
export class ObterCatalogoTagsUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(empresaId: string): Promise<TagCatalogo[]> {
    const customizadas = await this.repositorio.listarTagsPorEmpresa(empresaId);
    return [
      ...TAGS_SISTEMA.map((nome): TagCatalogo => ({ nome, origem: 'sistema', descricao: null })),
      ...customizadas.map((tag): TagCatalogo => ({ nome: tag.nomeTag, origem: 'customizada', descricao: tag.descricao })),
    ];
  }
}
