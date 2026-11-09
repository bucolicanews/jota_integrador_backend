// Papéis deixam de ser um catálogo fechado (ver migration 20261108000002) -- SUPER_ADMIN
// pode criar papel novo pela UI (/admin/papeis), com escopo e checklist de permissões
// próprios. `Papel` continua um objeto com os 7 nomes de sistema (pra não precisar tocar
// nos ~60 usos de `Papel.SUPER_ADMIN` etc espalhados pelos controllers -- esses 7 nunca
// mudam de nome), mas o TYPE é `string`: qualquer papel, de sistema ou customizado, é só
// um nome que existe como linha em `papeis` -- escopo/MFA/restrição granular são
// resolvidos consultando o banco (ou os claims do JWT, já sincronizados com essa
// informação), nunca indexando um Record fechado por literal.
export const Papel = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN_FINANCEIRO: 'ADMIN_FINANCEIRO',
  ADMIN_SUPORTE: 'ADMIN_SUPORTE',
  CONTADOR_DONO: 'CONTADOR_DONO',
  OPERADOR_CONTADOR: 'OPERADOR_CONTADOR',
  EMPRESARIO_DONO: 'EMPRESARIO_DONO',
  OPERADOR_EMPRESA: 'OPERADOR_EMPRESA',
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- par type+const de propósito (object com os nomes de sistema + type aberto pra aceitar papel customizado)
export type Papel = string;

export type EscopoPapel = 'plataforma' | 'contador' | 'empresa';

/** Metadados de uma linha de `papeis` -- é isso que claims/repositório resolvem por nome, nunca mais um Record indexado por literal TS. */
export interface InfoPapel {
  id: string;
  nome: string;
  escopo: EscopoPapel;
  descricao: string | null;
  sistema: boolean;
  nuncaRestringe: boolean;
  /** Dono do papel customizado (CONTADOR_DONO criou pra própria equipe) -- null = global (sistema ou customizado-global de SUPER_ADMIN). */
  contadorId: string | null;
  /** Dono do papel customizado (EMPRESARIO_DONO criou pra própria equipe) -- null = global. */
  empresaId: string | null;
}

export function ehPapelDePlataforma(escopo: EscopoPapel): boolean {
  return escopo === 'plataforma';
}

/**
 * Regra de negócio pura (docs/BANCO_DE_DADOS.md §1, tabela de coerência escopo/vínculo):
 * o vínculo (contadorId/empresaId) precisa bater com o escopo do papel. Mesma regra já
 * expressa como CHECK/trigger no banco (0002_identidade_hierarquia.sql) -- validada aqui
 * também, na Application layer, porque toda camada deve revalidar (Zero Trust,
 * docs/SEGURANCA.md), não só confiar que a constraint do banco vai pegar o erro depois.
 *
 * Recebe o escopo já RESOLVIDO (quem chama busca `papeis.escopo` por nome antes) -- não dá
 * mais pra indexar um Record TS fechado, já que papel agora é dinâmico.
 */
export function validarCoerenciaEscopo(
  escopo: EscopoPapel,
  contadorId: string | null,
  empresaId: string | null,
): void {
  if (escopo === 'plataforma' && (contadorId !== null || empresaId !== null)) {
    throw new Error(`Papel de escopo plataforma não pode ter contador_id/empresa_id vinculado`);
  }
  if (escopo === 'contador' && contadorId === null) {
    throw new Error(`Papel de escopo contador exige contador_id`);
  }
  if (escopo === 'empresa' && empresaId === null) {
    throw new Error(`Papel de escopo empresa exige empresa_id`);
  }
  if (contadorId !== null && empresaId !== null) {
    throw new Error('Usuário não pode ter contador_id e empresa_id preenchidos ao mesmo tempo');
  }
}
