import { Inject, Injectable } from '@nestjs/common';
import { FORNECEDORES_REPOSITORIO, Fornecedor, FornecedoresRepositorioPort } from '../portas/fornecedores-repositorio.port';

@Injectable()
export class ListarFornecedoresUseCase {
  constructor(@Inject(FORNECEDORES_REPOSITORIO) private readonly repositorio: FornecedoresRepositorioPort) {}

  async executar(empresaId: string, apenasAtivos?: boolean): Promise<Fornecedor[]> {
    return this.repositorio.listarPorEmpresa(empresaId, apenasAtivos);
  }
}
