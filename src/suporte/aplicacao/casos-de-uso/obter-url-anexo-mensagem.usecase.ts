import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_REPOSITORIO, MensagensRepositorioPort } from '../portas/mensagens-repositorio.port';
import { StorageSuporteService } from '../../infraestrutura/storage-suporte.service';

export interface UrlAnexoMensagem {
  url: string;
  expiraEmSegundos: number;
}

@Injectable()
export class ObterUrlAnexoMensagemUseCase {
  constructor(
    @Inject(MENSAGENS_REPOSITORIO) private readonly mensagensRepositorio: MensagensRepositorioPort,
    private readonly storage: StorageSuporteService,
  ) {}

  /** `ticketId` reconfirma que a mensagem pertence ao ticket já validado (posse) pelo controller -- nunca confia só no mensagemId. */
  async executar(ticketId: string, mensagemId: string): Promise<UrlAnexoMensagem> {
    const mensagem = await this.mensagensRepositorio.obterPorId(mensagemId);
    if (!mensagem || mensagem.ticketId !== ticketId || !mensagem.anexoStorageRef) {
      throw new NotFoundException('Anexo não encontrado');
    }
    return this.storage.gerarUrlAssinada(mensagem.anexoStorageRef);
  }
}
