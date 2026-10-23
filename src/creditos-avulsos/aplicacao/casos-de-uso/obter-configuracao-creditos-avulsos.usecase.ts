import { Inject, Injectable } from '@nestjs/common';
import {
  CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO,
  ConfiguracaoCreditosAvulsos,
  ConfiguracaoCreditosAvulsosRepositorioPort,
} from '../portas/configuracao-creditos-avulsos-repositorio.port';

@Injectable()
export class ObterConfiguracaoCreditosAvulsosUseCase {
  constructor(
    @Inject(CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO) private readonly repositorio: ConfiguracaoCreditosAvulsosRepositorioPort,
  ) {}

  async executar(): Promise<ConfiguracaoCreditosAvulsos> {
    return this.repositorio.obter();
  }
}
