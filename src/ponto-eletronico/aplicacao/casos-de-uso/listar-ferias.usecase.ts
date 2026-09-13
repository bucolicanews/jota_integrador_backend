import { Inject, Injectable } from '@nestjs/common';
import { FERIAS_PONTO_REPOSITORIO, FeriasPonto, FeriasPontoRepositorioPort } from '../portas/ferias-ponto-repositorio.port';

/** Posse já validada pelo controller antes de chamar. */
@Injectable()
export class ListarFeriasUseCase {
  constructor(@Inject(FERIAS_PONTO_REPOSITORIO) private readonly feriasRepositorio: FeriasPontoRepositorioPort) {}

  async executar(usuarioId: string): Promise<FeriasPonto[]> {
    return this.feriasRepositorio.listarPorUsuario(usuarioId);
  }
}
