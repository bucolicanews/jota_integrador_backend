import { FiltroDonoPapel } from './permissoes-repositorio.port';
import { Metodo2FA } from './provedor-identidade.port';
import { InfoPapel, Papel } from '../../dominio/papel';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  contadorId: string | null;
  empresaId: string | null;
  /** Preferência de segundo fator do PRÓPRIO usuário -- ver docs/SEGURANCA.md §8 (2026-11-09). */
  metodo2fa: Metodo2FA;
  status: 'ativo' | 'inativo';
  bloqueado: boolean;
  /** Lockout automático por senha errada repetida (hook de auth, nunca ação de admin) -- null = sem lockout ativo. Distinto de `bloqueado` (manual). */
  bloqueioAutomaticoAte: string | null;
  /**
   * Antes de passar por ObterPerfilUseCase/AtualizarAvatarProprioUseCase isso é o `avatar_ref`
   * crú (path no bucket) ou null -- esses dois usecases resolvem pra signed URL antes de
   * devolver ao controller. Nunca expor o valor crú pro frontend.
   */
  avatarUrl: string | null;
}

export interface DadosNovoUsuario {
  id: string; // já criado no provedor de identidade -- este port só persiste o perfil
  nome: string;
  email: string;
  papelId: string;
  contadorId: string | null;
  empresaId: string | null;
}

/** Abstração sobre a tabela `usuarios` (perfil) -- nunca acoplar Application a Supabase direto. */
export interface UsuariosRepositorioPort {
  criar(dados: DadosNovoUsuario): Promise<Usuario>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  /**
   * Lista usuários por vínculo -- `contadorId` (escopo `contador`, o próprio escritório)
   * e/ou `empresaIds` (escopo `empresa`, uma ou mais empresas da carteira). Os dois juntos
   * unem "meus funcionários" + "funcionários dos clientes" numa lista só (OR).
   */
  listar(filtro: { contadorId: string | null; empresaIds: string[]; plataforma?: boolean }): Promise<Usuario[]>;
  atualizarPapelEVinculo(
    id: string,
    papelId: string,
    contadorId: string | null,
    empresaId: string | null,
  ): Promise<void>;
  marcarBloqueio(id: string, bloqueado: boolean, motivo: string | null, executadoPorId: string): Promise<void>;
  /** Resolve só papel GLOBAL (sistema ou customizado-global) -- os 3 call sites que usam isso hoje (teto por dono) só tratam dos 4 papéis restringíveis de sistema, sempre globais. */
  buscarIdPapelPorNome(nomePapel: Papel): Promise<string>;
  /**
   * Metadados completos (escopo, nuncaRestringe, sistema, dono) -- usado por quem precisa
   * validar coerência de escopo ou decidir concessão granular, não só o id. Resolve dentro
   * do filtro de dono informado (global OU o dono específico) -- nome não é mais único
   * global, resolver sem esse filtro seria ambíguo entre contadores/empresas diferentes.
   */
  buscarPapelPorNome(nomePapel: Papel, filtro: FiltroDonoPapel): Promise<InfoPapel>;
  /** Resolve direto pelo `papel_id` já gravado no usuário -- sem ambiguidade de nome/dono (ver buscarPapelPorNome). Usado pra ressincronizar claims preservando papel/vínculo atuais ao mudar só a preferência de 2FA. */
  buscarInfoPapelDoUsuario(usuarioId: string): Promise<InfoPapel>;
  atualizarNome(id: string, nome: string): Promise<void>;
  /** Quantos usuários têm esse papel hoje -- usado pra bloquear exclusão de papel em uso (FK em `usuarios.papel_id` é quem garante de fato, isso só dá a mensagem amigável antes de tentar). */
  contarUsuariosComPapel(papelId: string): Promise<number>;
  atualizarEmail(id: string, email: string): Promise<void>;
  atualizarAvatarRef(id: string, avatarRef: string | null): Promise<void>;
  /** Preferência de 2FA escolhida pelo próprio usuário (ver dominio/papel.ts -- já não existe mais exigência fixa por escopo). */
  atualizarMetodo2fa(id: string, metodo: Metodo2FA): Promise<void>;
  /** Gera e guarda (hash, nunca texto puro) o código de 2FA por email enviado agora -- zera tentativas. */
  salvarCodigoEmail2fa(id: string, codigo: string, ttlMs: number): Promise<void>;
  /** Confirma o código de 2FA por email -- incrementa tentativas a cada chamada, nunca deixa passar do limite nem reusar código já consumido. */
  verificarCodigoEmail2fa(id: string, codigo: string): Promise<'valido' | 'invalido' | 'expirado' | 'muitas_tentativas'>;
  /**
   * Chamado pelo hook "Password Verification Attempt" do Supabase (ver src/supabase-hooks/)
   * pra cada tentativa de login -- sucesso zera o contador, falha incrementa e, ao
   * atingir o limite, grava `bloqueio_automatico_ate` e zera o contador de novo (próxima
   * janela começa limpa). Retorna o novo `bloqueio_automatico_ate` (null = sem lockout).
   */
  registrarTentativaLogin(id: string, sucesso: boolean): Promise<string | null>;
}

export const USUARIOS_REPOSITORIO = Symbol('USUARIOS_REPOSITORIO');
