import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { validarDocumentoSePresente } from '../../dominio/cliente';
import { CLIENTES_REPOSITORIO, Cliente, ClientesRepositorioPort, DadosCliente } from '../portas/clientes-repositorio.port';

@Injectable()
export class CriarClienteUseCase {
  constructor(@Inject(CLIENTES_REPOSITORIO) private readonly repositorio: ClientesRepositorioPort) {}

  async executar(dados: DadosCliente): Promise<Cliente> {
    if (!validarDocumentoSePresente(dados.documento)) {
      throw new BadRequestException('CPF/CNPJ inválido');
    }
    return this.repositorio.criar(dados);
  }
}
