import { Inject, Injectable } from '@nestjs/common';
import { ConfiguracaoLancamentosDas, DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';

@Injectable()
export class BuscarConfiguracaoLancamentosDasUseCase {
  constructor(@Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort) {}

  async executar(empresaId: string): Promise<ConfiguracaoLancamentosDas | null> {
    return this.dasRepositorio.buscarConfiguracaoLancamentos(empresaId);
  }
}
