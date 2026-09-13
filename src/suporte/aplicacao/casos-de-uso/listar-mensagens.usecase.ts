import { Inject, Injectable } from '@nestjs/common';
import { MENSAGENS_REPOSITORIO, MensagemTicket, MensagensRepositorioPort } from '../portas/mensagens-repositorio.port';

/** Posse do ticket já validada pelo controller antes de chamar -- aqui só busca a thread. */
@Injectable()
export class ListarMensagensUseCase {
  constructor(@Inject(MENSAGENS_REPOSITORIO) private readonly mensagensRepositorio: MensagensRepositorioPort) {}

  async executar(ticketId: string): Promise<MensagemTicket[]> {
    return this.mensagensRepositorio.listarPorTicket(ticketId);
  }
}
