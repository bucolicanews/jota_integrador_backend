import { Papel } from '../../dominio/papel';

export interface ClaimsIdentidade {
  papel: Papel;
  contadorId: string | null;
  empresaId: string | null;
}

export interface IdentidadeValidada extends ClaimsIdentidade {
  id: string;
}

/**
 * Abstração sobre o provedor de autenticação (Supabase Auth). Separado do repositório
 * de `usuarios` (docs/BANCO_DE_DADOS.md §1) porque são sistemas diferentes: aqui é
 * identidade/sessão (auth.users), lá é perfil de domínio (usuarios).
 */
export interface ResultadoCriarUsuarioComConvite {
  id: string;
  /**
   * true quando o e-mail já existia no provedor (identidade órfã de uma tentativa
   * anterior que não terminou de criar o perfil, ex: convite aceito mas
   * CriarUsuarioUseCase falhou no meio) -- não é erro por si, quem chama decide o que
   * fazer (reaproveitar o id só se não existir perfil em `usuarios` pra esse e-mail).
   */
  jaExistiaNoProvedor: boolean;
}

export interface ProvedorIdentidadePort {
  /**
   * Cria a identidade (auth.users) e envia convite por e-mail -- retorna o id
   * (= usuarios.id). Se o e-mail já existir no provedor, NÃO lança: devolve o id
   * existente com `jaExistiaNoProvedor: true`, sem reenviar convite (generateLink não
   * envia e-mail, só recupera o id).
   */
  criarUsuarioComConvite(email: string): Promise<ResultadoCriarUsuarioComConvite>;

  /**
   * Gera um link de acesso (tipo `recovery`) pro e-mail informado -- usado tanto pra
   * "primeiro acesso" (depois de `criarUsuarioComConvite`, já que o e-mail do convite
   * pode nunca chegar -- SMTP não configurado/instável) quanto pra "reenviar link" de um
   * usuário já existente que perdeu o acesso. SEMPRE `recovery`, nunca `invite`: só
   * `recovery` dispara o evento `PASSWORD_RECOVERY` no client-side (`onAuthStateChange`),
   * que o frontend usa pra forçar a tela de "defina sua senha" antes de liberar o resto
   * do app -- `invite` cai como `SIGNED_IN` comum, sem esse gancho. Requer que o usuário
   * já exista no provedor (chamar depois de `criarUsuarioComConvite`, nunca antes).
   */
  gerarLinkAcesso(email: string): Promise<string>;

  /**
   * Sincroniza papel/contador_id/empresa_id no app_metadata do usuário no provedor.
   * Crítico: é isso que o RLS lê (auth.jwt() -> app_metadata) -- esquecer de chamar
   * depois de mudar papel/vínculo deixa o RLS desatualizado (docs/BANCO_DE_DADOS.md §1).
   */
  sincronizarClaims(id: string, claims: ClaimsIdentidade): Promise<void>;

  /** Ban nativo do provedor -- impede login imediatamente, não só marca flag no banco. */
  bloquearAcesso(id: string): Promise<void>;
  desbloquearAcesso(id: string): Promise<void>;

  /** Revoga todas as sessões ativas do usuário (logout global). */
  revogarSessoes(id: string): Promise<void>;

  /**
   * Valida um JWT emitido pelo provedor e retorna id + claims (papel/contador_id/
   * empresa_id) direto do app_metadata do token -- sem round-trip ao banco a cada
   * requisição (esse é o motivo de sincronizar claims no JWT em primeiro lugar).
   */
  validarToken(token: string): Promise<IdentidadeValidada>;
}

export const PROVEDOR_IDENTIDADE = Symbol('PROVEDOR_IDENTIDADE');
