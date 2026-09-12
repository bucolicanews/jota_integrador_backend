import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

@Injectable()
export class ExcluirModeloContratoUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<void> {
    const modelo = await this.repositorio.obterModeloPorId(id);
    if (!modelo || modelo.empresaId !== empresaId) {
      throw new NotFoundException('Modelo de contrato não encontrado');
    }
    // Se algum contrato já foi gerado a partir deste modelo, a FK (contratos_gerados.modelo_id,
    // sem "on delete") bloqueia o DELETE -- diferente de modelos_societarios (on delete set
    // null), aqui é intencional: modelo usado em contrato financeiro não deve sumir em silêncio.
    await this.repositorio.excluirModelo(id);
  }
}
