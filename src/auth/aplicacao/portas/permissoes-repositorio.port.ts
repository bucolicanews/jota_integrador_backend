import { EscopoPapel, InfoPapel } from '../../dominio/papel';

export interface Permissao {
  id: string;
  recurso: string;
  acao: string;
  chave: string; // "recurso:acao", coluna gerada no banco
}

/** `contadorId`/`empresaId` ambos null = só papéis globais (sistema + customizado-global de SUPER_ADMIN). Um dos dois preenchido = globais + os privados daquele dono (nunca os de outro dono). */
export interface FiltroDonoPapel {
  contadorId: string | null;
  empresaId: string | null;
}

export interface DadosNovoPapel {
  nome: string;
  escopo: EscopoPapel;
  descricao: string | null;
  permissaoIds: string[];
  contadorId: string | null;
  empresaId: string | null;
}

export interface DadosAtualizarPapel {
  descricao: string | null;
  permissaoIds: string[];
}

export interface PermissoesRepositorioPort {
  /** Catálogo de papéis (os 7 de sistema + customizados) -- pra tela /admin/papeis e pro select de "Papel" na criação de usuário. Filtra globais + os privados do dono informado, nunca de outro dono. */
  listarPapeis(filtro: FiltroDonoPapel): Promise<InfoPapel[]>;
  buscarPapelPorId(id: string): Promise<InfoPapel | null>;
  /** Cria papel customizado (sempre `sistema=false`, `nunca_restringe=false`) + grava o teto inicial em `papel_permissoes`. Nome único só dentro do mesmo dono (ou entre os globais) -- erro de conflito já vira 409 na camada de apresentação. */
  criarPapel(dados: DadosNovoPapel): Promise<InfoPapel>;
  /** Nome/escopo são imutáveis (papéis de sistema nem chegam aqui -- bloqueado na camada de aplicação). Substitui `permissaoIds` (delete+insert), igual padrão de `definirTetoDono`. */
  atualizarPapel(id: string, dados: DadosAtualizarPapel): Promise<void>;
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
