export interface Permissao {
  id: string;
  recurso: string;
  acao: string;
  chave: string; // "recurso:acao", coluna gerada no banco
}

export interface PermissoesRepositorioPort {
  /** Teto global: quais permissões fazem sentido pro escopo desse papel (papel_permissoes) -- catálogo assinalável, não concessão de fato. */
  listarPermissoesDoPapel(papelId: string): Promise<Permissao[]>;
  /** Catálogo completo (todas as permissões cadastradas), pra montar o checklist de configuração do teto. */
  listarCatalogoPermissoes(): Promise<Permissao[]>;
  /**
   * Teto EFETIVO pra um papel dentro do vínculo de um dono específico (contador/empresa/
   * plataforma) -- usa o override de papel_permissoes_dono se existir pra esse dono, senão
   * cai no teto global (listarPermissoesDoPapel). `contadorId`/`empresaId` null/null =
   * escopo plataforma.
   */
  obterTetoEfetivo(papelId: string, contadorId: string | null, empresaId: string | null): Promise<Permissao[]>;
  /** Substitui (delete+insert) o override de teto de um papel pra um dono específico. */
  definirTetoDono(papelId: string, contadorId: string | null, empresaId: string | null, permissaoIds: string[]): Promise<void>;
  /** Concessões de fato desse usuário (usuario_permissoes). */
  listarPermissoesDoUsuario(usuarioId: string): Promise<Permissao[]>;
  usuarioTemPermissao(usuarioId: string, chave: string): Promise<boolean>;
  buscarPermissaoPorId(id: string): Promise<Permissao | null>;
  /** Concede -- não checa teto aqui, quem chama (o caso de uso) já validou contra o teto efetivo. */
  conceder(usuarioId: string, permissaoId: string, concedidoPorId: string): Promise<void>;
  revogar(usuarioId: string, permissaoId: string): Promise<void>;
}

export const PERMISSOES_REPOSITORIO = Symbol('PERMISSOES_REPOSITORIO');
