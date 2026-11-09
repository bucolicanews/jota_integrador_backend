import { EscopoPapel, Papel } from '../../dominio/papel';

export type Metodo2FA = 'nenhum' | 'totp' | 'email';

export interface ClaimsIdentidade {
  papel: Papel;
  /**
   * Escopo e "nunca restringe" do papel no momento da sincronização -- embutidos no
   * app_metadata junto com papel/contadorId/empresaId (mesmo motivo de sempre: evitar
   * round-trip ao banco a cada requisição autenticada). Resolvido pelo caller consultando
   * `papeis` por nome antes de chamar `sincronizarClaims` -- nunca derivado de um Record
   * TS fechado, já que papel é dinâmico desde 2026-11-08.
   */
  escopo: EscopoPapel;
  nuncaRestringe: boolean;
  contadorId: string | null;
  empresaId: string | null;
  /**
   * Preferência de segundo fator do PRÓPRIO usuário (docs/SEGURANCA.md §8, atualização
   * 2026-11-09) -- opcional pra qualquer papel, inclusive plataforma; nunca mais um
   * bloqueio fixo por escopo. Sincronizado no app_metadata pelo mesmo motivo de sempre
   * (SupabaseAuthGuard decide sem consultar o banco a cada requisição).
   */
  metodo2fa: Metodo2FA;
}

export interface IdentidadeValidada extends ClaimsIdentidade {
  id: string;
  /**
   * true se o usuário tem pelo menos um fator MFA (TOTP) com status `verified` no
   * provedor -- lido direto de `data.user.factors` no mesmo `getUser()` que já valida o
   * token (sem round-trip extra). Só é consultado quando `metodo2fa === 'totp'` -- a
   * fonte de verdade pra enforcement é sempre o estado vivo do provedor, pra ninguém
   * conseguir "escolher TOTP" sem ter de fato um fator verificado.
   */
  mfaVerificado: boolean;
  /**
   * Authenticator Assurance Level do token atual ('aal1' = só senha, 'aal2' = completou
   * desafio MFA). Claim de sessão do próprio JWT (não vem de `getUser()`) -- decodificado
   * direto do payload, sem verificar assinatura de novo (o `getUser()` já validou a
   * autenticidade do token junto ao provedor nesta mesma chamada).
   */
  aal: 'aal1' | 'aal2';
  /**
   * `session_id` do JWT -- estável entre refreshes do MESMO login (só muda em novo
   * login). Usado só quando `metodo2fa === 'email'`, pra saber se ESTA sessão já
   * confirmou o código (tabela `sessoes_2fa_email_verificadas`) -- Supabase não tem
   * conceito de "aal" pra um fator que ele não conhece (email não é fator nativo dele).
   */
  sessionId: string;
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

  /**
   * Troca o e-mail de login (auth.users) -- já confirmado (`email_confirm: true`), nunca
   * dependeu de SMTP pra funcionar, mesmo espírito de login 100% por link já usado no
   * resto do provedor (nunca dupla-confirmação por e-mail antigo/novo).
   */
  atualizarEmail(id: string, novoEmail: string): Promise<void>;

  /** Admin define a senha de login de outro usuário direto (sem fluxo de link) -- o próprio usuário troca a própria senha via `supabase.auth.updateUser` no client, nunca por aqui. */
  atualizarSenha(id: string, novaSenha: string): Promise<void>;

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

  /**
   * Checagem autoritativa (admin API, não confia no client) de que o `factorId`
   * informado existe, pertence a este usuário e está `verified` -- usada depois que o
   * client termina `supabase.auth.mfa.enroll()+verify()`, antes de aceitar
   * `metodo_2fa = 'totp'` como escolha (nunca aceitar só porque o client disse que deu certo).
   */
  fatorMfaVerificado(usuarioId: string, factorId: string): Promise<boolean>;

  /** true se o usuário ainda tem algum fator `verified` -- usado pela tela de Perfil pra saber se pode oferecer "TOTP" como opção sem precisar reenrolar. */
  possuiFatorMfaVerificado(usuarioId: string): Promise<boolean>;
}

export const PROVEDOR_IDENTIDADE = Symbol('PROVEDOR_IDENTIDADE');
