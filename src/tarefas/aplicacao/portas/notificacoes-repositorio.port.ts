export interface Notificacao {
  id: string;
  usuarioId: string;
  tarefaId: string | null;
  mensagem: string;
  lida: boolean;
  criadoEm: string;
}

export interface NotificacoesRepositorioPort {
  criar(dados: { usuarioId: string; tarefaId: string | null; mensagem: string }): Promise<Notificacao>;
  listarPorUsuario(usuarioId: string): Promise<Notificacao[]>;
  /** Só marca se `usuario_id` bater com quem pediu -- nunca deixa marcar notificação de outro. */
  marcarLida(id: string, usuarioId: string): Promise<void>;
}

export const NOTIFICACOES_REPOSITORIO = Symbol('NOTIFICACOES_REPOSITORIO');
