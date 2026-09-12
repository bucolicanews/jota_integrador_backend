import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { validarDocumentoSePresente } from '../../dominio/cliente';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort, DadosCliente } from '../portas/clientes-repositorio.port';

@Injectable()
export class AtualizarClienteUseCase {
  constructor(@Inject(CLIENTES_REPOSITORIO) private readonly repositorio: ClientesRepositorioPort) {}

  async executar(id: string, empresaId: string, dados: Partial<DadosCliente>): Promise<void> {
    const cliente = await this.repositorio.obterPorId(id);
    if (!cliente || cliente.empresaId !== empresaId) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (dados.documento !== undefined && !validarDocumentoSePresente(dados.documento)) {
      throw new BadRequestException('CPF/CNPJ inválido');
    }
    await this.repositorio.atualizar(id, dados);
  }
}
