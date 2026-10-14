import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { modulosValidos, validarPrecoGratuito } from '../../dominio/pacote-modulos';
import { DadosPacoteModulos, PACOTES_MODULOS_REPOSITORIO, PacotesModulosRepositorioPort } from '../portas/pacotes-modulos-repositorio.port';

@Injectable()
export class AtualizarPacoteModulosUseCase {
  constructor(@Inject(PACOTES_MODULOS_REPOSITORIO) private readonly repositorio: PacotesModulosRepositorioPort) {}

  async executar(id: string, dados: Partial<DadosPacoteModulos>): Promise<void> {
    const pacote = await this.repositorio.obterPorId(id);
    if (!pacote) throw new NotFoundException('Pacote não encontrado');
    if (dados.modulos !== undefined && !modulosValidos(dados.modulos)) {
      throw new BadRequestException('Pacote precisa de ao menos 1 módulo válido');
    }
    // Valida o estado EFETIVO pós-patch (mescla com o que já existe) -- um PATCH só com
    // {preco: 0} num pacote hoje pago, sem vir junto com gratuito:true, tem que ser rejeitado.
    const precoEfetivo = dados.preco ?? pacote.preco;
    const gratuitoEfetivo = dados.gratuito ?? pacote.gratuito;
    try {
      validarPrecoGratuito(precoEfetivo, gratuitoEfetivo);
    } catch (erro) {
      throw new BadRequestException((erro as Error).message);
    }
    await this.repositorio.atualizar(id, dados);
  }
}
