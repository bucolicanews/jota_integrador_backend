export interface Permissao {
  id: string;
  recurso: string;
  acao: string;
  chave: string; // "recurso:acao", coluna gerada no banco
}

export interface PermissoesRepositorioPort {
  /** Teto: quais permissões fazem sentido pro escopo desse papel (papel_permissoes) -- catálogo assinalável, não concessão de fato. */
  listarPermissoesDoPapel(papelId: string): Promise<Permissao[]>;
  /** Concessões de fato desse usuário (usuario_permissoes). */
  listarPermissoesDoUsuario(usuarioId: string): Promise<Permissao[]>;
  usuarioTemPermissao(usuarioId: string, chave: string): Promise<boolean>;
  buscarPermissaoPorId(id: string): Promise<Permissao | null>;
  /** Concede -- não checa teto aqui, quem chama (o caso de uso) já validou contra papel_permissoes. */
  conceder(usuarioId: string, permissaoId: string, concedidoPorId: string): Promise<void>;
  revogar(usuarioId: string, permissaoId: string): Promise<void>;
}

export const PERMISSOES_REPOSITORIO = Symbol('PERMISSOES_REPOSITORIO');
