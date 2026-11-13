import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICACOES_REPOSITORIO, NotificacoesRepositorioPort } from '../portas/notificacoes-repositorio.port';

@Injectable()
export class MarcarNotificacaoLidaUseCase {
  constructor(
    @Inject(NOTIFICACOES_REPOSITORIO) private readonly repositorio: NotificacoesRepositorioPort,
  ) {}

  async executar(id: string, usuarioId: string): Promise<void> {
    await this.repositorio.marcarLida(id, usuarioId);
  }
}
