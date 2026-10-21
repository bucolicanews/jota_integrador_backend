import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DadosAtualizacaoPacoteCreditoAvulso,
  PACOTES_CREDITOS_AVULSOS_REPOSITORIO,
  PacoteCreditoAvulso,
  PacotesCreditosAvulsosRepositorioPort,
} from '../portas/pacotes-creditos-avulsos-repositorio.port';

@Injectable()
export class AtualizarPacoteCreditoAvulsoUseCase {
  constructor(
    @Inject(PACOTES_CREDITOS_AVULSOS_REPOSITORIO) private readonly repositorio: PacotesCreditosAvulsosRepositorioPort,
  ) {}

  async executar(id: string, dados: DadosAtualizacaoPacoteCreditoAvulso): Promise<PacoteCreditoAvulso> {
    const atual = await this.repositorio.buscarPorId(id);
    if (!atual) {
      throw new NotFoundException('Pacote de crédito avulso não encontrado');
    }
    if (dados.quantidadeCreditos !== undefined && dados.quantidadeCreditos <= 0) {
      throw new BadRequestException('quantidadeCreditos precisa ser maior que zero');
    }
    if (dados.precoReais !== undefined && dados.precoReais <= 0) {
      throw new BadRequestException('precoReais precisa ser maior que zero');
    }
    return this.repositorio.atualizar(id, dados);
  }
}
