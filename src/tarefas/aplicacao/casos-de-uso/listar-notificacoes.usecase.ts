import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICACOES_REPOSITORIO, Notificacao, NotificacoesRepositorioPort } from '../portas/notificacoes-repositorio.port';

@Injectable()
export class ListarNotificacoesUseCase {
  constructor(
    @Inject(NOTIFICACOES_REPOSITORIO) private readonly repositorio: NotificacoesRepositorioPort,
  ) {}

  async executar(usuarioId: string): Promise<Notificacao[]> {
    return this.repositorio.listarPorUsuario(usuarioId);
  }
}
