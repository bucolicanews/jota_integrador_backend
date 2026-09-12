import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort, DadosModeloContrato } from '../portas/contratos-repositorio.port';

@Injectable()
export class AtualizarModeloContratoUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(id: string, empresaId: string, dados: Partial<DadosModeloContrato>): Promise<void> {
    const modelo = await this.repositorio.obterModeloPorId(id);
    if (!modelo || modelo.empresaId !== empresaId) {
      throw new NotFoundException('Modelo de contrato não encontrado');
    }
    await this.repositorio.atualizarModelo(id, dados);
  }
}
