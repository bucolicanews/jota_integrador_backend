import { IsEmail, IsOptional, Matches, MaxLength, MinLength } from 'class-validator';
import { Papel } from '../../dominio/papel';

// `@IsUUID()` do class-validator rejeita o id sentinela 'Jota Contabilidade'
// (00000000-0000-0000-0000-000000000001 -- dígito de versão '0', fora de 1-5) -- mesmo
// ajuste já feito em transferir-carteira-empresa.dto.ts. Formato solto (8-4-4-4-12 hex),
// a existência de verdade é garantida pela FK (23503 tratado no repositório).
const REGEX_UUID_SOLTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DTO com whitelist explícita de campos -- nunca aceitar o body inteiro (regra de mass
// assignment já documentada no PENTEST_CODE_REVIEW_PROTOCOL.md do vault).
//
// Sem checagem de coerência papel×contadorId/empresaId aqui (ao contrário de
// atualizar-papel-usuario.dto.ts) -- CONTADOR_DONO/EMPRESARIO_DONO nunca mandam
// contadorId/empresaId no body (resolverVinculoPermitido() no controller resolve isso
// pelo PRÓPRIO vínculo de quem chama, depois da validação do DTO); só SUPER_ADMIN manda
// os dois ids de verdade. Validar a coerência aqui, sobre o valor CRU do cliente, rejeitava
// toda criação de operador feita por um contador/empresa de verdade (bug real, 2026-11-06).
// A coerência de fato é checada em CriarUsuarioUseCase (validarCoerenciaEscopo), já sobre
// o vínculo RESOLVIDO -- esse é o lugar certo pra essa regra.
export class CriarUsuarioDto {
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsEmail()
  email!: string;

  // Papel é dinâmico desde 2026-11-08 (qualquer linha de `papeis`, não um enum fechado) --
  // sem @IsEnum aqui, a existência de verdade é garantida pela FK (papel_id) + buscarPapelPorNome
  // (NotFoundException se o nome não existir no catálogo), mesmo princípio do REGEX_UUID_SOLTO acima.
  @MinLength(1)
  @MaxLength(60)
  papel!: Papel;

  @IsOptional()
  @Matches(REGEX_UUID_SOLTO, { message: 'contadorId deve ser um identificador válido' })
  contadorId?: string | null;

  @IsOptional()
  @Matches(REGEX_UUID_SOLTO, { message: 'empresaId deve ser um identificador válido' })
  empresaId?: string | null;
}
