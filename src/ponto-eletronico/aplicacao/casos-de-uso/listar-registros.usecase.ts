import { Inject, Injectable } from '@nestjs/common';
import { intervaloDoMes } from '../intervalo-datas';
import { REGISTROS_PONTO_REPOSITORIO, RegistroPonto, RegistrosPontoRepositorioPort } from '../portas/registros-ponto-repositorio.port';

/** Posse já validada pelo controller antes de chamar. */
@Injectable()
export class ListarRegistrosUseCase {
  constructor(@Inject(REGISTROS_PONTO_REPOSITORIO) private readonly registrosRepositorio: RegistrosPontoRepositorioPort) {}

  async executar(usuarioId: string, ano: number, mes: number): Promise<RegistroPonto[]> {
    const { inicio, fim } = intervaloDoMes(ano, mes);
    return this.registrosRepositorio.listar({ usuarioId, inicio, fim });
  }
}
