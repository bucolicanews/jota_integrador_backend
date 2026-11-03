import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CONTADORES_REPOSITORIO,
  Contador,
  ContadoresRepositorioPort,
} from '../portas/contadores-repositorio.port';

export const CHAVES_MODULO_VALIDAS = [
  'conciliacao_bancaria',
  'bancos',
  'fiscal',
  'protocolos',
  'contratos',
  'documentos_societarios',
  'relatorios',
];

/** Admin-only -- controla o que o escritório PRÓPRIO do contador pode usar, nunca empresa-cliente da carteira (essas continuam via plano da assinatura). */
@Injectable()
export class AtualizarModulosLiberadosContadorUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
  ) {}

  async executar(contadorId: string, modulos: string[]): Promise<Contador> {
    const invalidos = modulos.filter((m) => !CHAVES_MODULO_VALIDAS.includes(m));
    if (invalidos.length > 0) {
      throw new BadRequestException(`Módulo(s) inválido(s): ${invalidos.join(', ')}`);
    }

    await this.contadoresRepositorio.atualizarModulosLiberados(contadorId, modulos);

    const atualizado = await this.contadoresRepositorio.buscarPorId(contadorId);
    if (!atualizado) {
      throw new NotFoundException('Contador não encontrado após atualização');
    }
    return atualizado;
  }
}
