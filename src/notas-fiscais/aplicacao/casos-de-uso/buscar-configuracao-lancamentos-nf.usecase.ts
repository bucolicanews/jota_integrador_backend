import { Inject, Injectable } from '@nestjs/common';
import { ConfiguracaoLancamentosNf, NOTAS_FISCAIS_REPOSITORIO, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';

@Injectable()
export class BuscarConfiguracaoLancamentosNfUseCase {
  constructor(@Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly repositorio: NotasFiscaisRepositorioPort) {}

  async executar(empresaId: string): Promise<ConfiguracaoLancamentosNf | null> {
    return this.repositorio.buscarConfiguracaoLancamentos(empresaId);
  }
}
