export interface AgenteNotasFiscais {
  id: string;
  empresaId: string;
  ativo: boolean;
  ultimoUsoEm: string | null;
  criadoEm: string;
}

export interface AgentesNotasFiscaisRepositorioPort {
  /** Revoga qualquer token ativo da empresa (se houver) e cria um novo -- só 1 ativo por vez. */
  criar(empresaId: string, tokenHash: string, criadoPor: string): Promise<AgenteNotasFiscais>;
  /** Só considera token ativo -- usado pelo TokenAgenteGuard em toda requisição de ingestão. */
  buscarPorTokenHash(tokenHash: string): Promise<{ id: string; empresaId: string } | null>;
  /** Status exibido na tela do agente (dashboard) -- null = nunca gerou token pra essa empresa. */
  buscarAtivoPorEmpresa(empresaId: string): Promise<AgenteNotasFiscais | null>;
  revogar(empresaId: string): Promise<void>;
  marcarUltimoUso(id: string): Promise<void>;
}

export const AGENTES_NOTAS_FISCAIS_REPOSITORIO = Symbol('AGENTES_NOTAS_FISCAIS_REPOSITORIO');
