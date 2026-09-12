import { Inject, Injectable } from '@nestjs/common';
import { IDENTIFICADORES_EXTRATO_REPOSITORIO, IdentificadorExtrato, IdentificadoresExtratoRepositorioPort } from '../portas/identificadores-extrato-repositorio.port';

@Injectable()
export class ListarIdentificadoresExtratoUseCase {
  constructor(@Inject(IDENTIFICADORES_EXTRATO_REPOSITORIO) private readonly repositorio: IdentificadoresExtratoRepositorioPort) {}

  async executar(empresaId: string): Promise<IdentificadorExtrato[]> {
    return this.repositorio.listarPorEmpresa(empresaId);
  }
}
