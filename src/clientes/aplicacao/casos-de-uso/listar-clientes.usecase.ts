import { Inject, Injectable } from '@nestjs/common';
import { CLIENTES_REPOSITORIO, Cliente, ClientesRepositorioPort } from '../portas/clientes-repositorio.port';

@Injectable()
export class ListarClientesUseCase {
  constructor(@Inject(CLIENTES_REPOSITORIO) private readonly repositorio: ClientesRepositorioPort) {}

  async executar(empresaId: string, apenasAtivos?: boolean): Promise<Cliente[]> {
    return this.repositorio.listarPorEmpresa(empresaId, apenasAtivos);
  }
}
