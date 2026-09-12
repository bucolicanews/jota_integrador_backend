import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONCILIACAO_REPOSITORIO, ConciliacaoRepositorioPort } from '../portas/conciliacao-repositorio.port';

@Injectable()
export class ExcluirConfiguracaoUseCase {
  constructor(@Inject(CONCILIACAO_REPOSITORIO) private readonly repositorio: ConciliacaoRepositorioPort) {}

  async executar(id: string, empresaId: string): Promise<void> {
    const existente = await this.repositorio.obterConfiguracao(id);
    if (!existente || existente.empresaId !== empresaId) {
      throw new NotFoundException('Configuração de conciliação não encontrada');
    }
    await this.repositorio.excluirConfiguracao(id);
  }
}
