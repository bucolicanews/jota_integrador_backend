import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DadosNovoPacoteCreditoAvulso,
  PACOTES_CREDITOS_AVULSOS_REPOSITORIO,
  PacoteCreditoAvulso,
  PacotesCreditosAvulsosRepositorioPort,
} from '../portas/pacotes-creditos-avulsos-repositorio.port';

@Injectable()
export class CriarPacoteCreditoAvulsoUseCase {
  constructor(
    @Inject(PACOTES_CREDITOS_AVULSOS_REPOSITORIO) private readonly repositorio: PacotesCreditosAvulsosRepositorioPort,
  ) {}

  async executar(dados: DadosNovoPacoteCreditoAvulso): Promise<PacoteCreditoAvulso> {
    if (dados.quantidadeCreditos <= 0) {
      throw new BadRequestException('quantidadeCreditos precisa ser maior que zero');
    }
    if (dados.precoReais <= 0) {
      throw new BadRequestException('precoReais precisa ser maior que zero');
    }
    return this.repositorio.criar(dados);
  }
}
