import { Inject, Injectable } from '@nestjs/common';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

@Injectable()
export class ObterConfiguracaoContratosUseCase {
  constructor(@Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort) {}

  async executar(empresaId: string) {
    return this.repositorio.obterConfiguracao(empresaId);
  }
}
