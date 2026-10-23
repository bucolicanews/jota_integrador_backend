import { Inject, Injectable } from '@nestjs/common';
import {
  CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO,
  ConfiguracaoCreditosAvulsosRepositorioPort,
} from '../portas/configuracao-creditos-avulsos-repositorio.port';

@Injectable()
export class DefinirValorPorCreditoUseCase {
  constructor(
    @Inject(CONFIGURACAO_CREDITOS_AVULSOS_REPOSITORIO) private readonly repositorio: ConfiguracaoCreditosAvulsosRepositorioPort,
  ) {}

  async executar(valorPorCredito: number): Promise<void> {
    await this.repositorio.definirValorPorCredito(valorPorCredito);
  }
}
