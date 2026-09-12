import { Inject, Injectable } from '@nestjs/common';
import {
  DadosIdentificadorExtrato,
  IDENTIFICADORES_EXTRATO_REPOSITORIO,
  IdentificadorExtrato,
  IdentificadoresExtratoRepositorioPort,
} from '../portas/identificadores-extrato-repositorio.port';

@Injectable()
export class CriarIdentificadorExtratoUseCase {
  constructor(@Inject(IDENTIFICADORES_EXTRATO_REPOSITORIO) private readonly repositorio: IdentificadoresExtratoRepositorioPort) {}

  async executar(dados: DadosIdentificadorExtrato): Promise<IdentificadorExtrato> {
    return this.repositorio.criar(dados);
  }
}
