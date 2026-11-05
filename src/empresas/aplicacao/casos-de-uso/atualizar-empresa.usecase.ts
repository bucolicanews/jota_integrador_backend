import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DadosAtualizacaoEmpresa,
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../portas/empresas-repositorio.port';

@Injectable()
export class AtualizarEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  // Só campos não-sensíveis (docs/BANCO_DE_DADOS.md) -- contador_id, bloqueado e
  // modo_acesso_serpro têm casos de uso/trigger próprios, nunca passam por aqui.
  async executar(id: string, dados: DadosAtualizacaoEmpresa): Promise<void> {
    if (dados.tipoPessoa !== undefined || dados.crc !== undefined) {
      const empresa = await this.empresasRepositorio.buscarPorId(id);
      if (!empresa) {
        throw new NotFoundException('Empresa não encontrada');
      }

      const tipoPessoaResultante = dados.tipoPessoa ?? empresa.tipoPessoa;
      if (tipoPessoaResultante === 'fisica' && empresa.tipo !== 'interna_contador') {
        throw new BadRequestException('Só a empresa interna do próprio contador pode ser pessoa física -- empresa-cliente é sempre jurídica');
      }

      const crcResultante = dados.crc !== undefined ? dados.crc : empresa.crc;
      if (tipoPessoaResultante === 'fisica' && !crcResultante) {
        throw new BadRequestException('CRC é obrigatório pra pessoa física');
      }
    }

    await this.empresasRepositorio.atualizar(id, dados);
  }
}
