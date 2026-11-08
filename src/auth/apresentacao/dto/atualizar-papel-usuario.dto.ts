import { IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Papel } from '../../dominio/papel';

// Sem checagem de coerência papel×contadorId/empresaId aqui (mesmo princípio de
// criar-usuario.dto.ts): papel agora é dinâmico (qualquer linha de `papeis`, não um enum
// fechado), então o escopo só existe consultando o banco -- a coerência de fato é checada
// em AtualizarPapelUsuarioUseCase (validarCoerenciaEscopo), já sobre o escopo resolvido.
export class AtualizarPapelUsuarioDto {
  @MinLength(1)
  @MaxLength(60)
  papel!: Papel;

  @IsOptional()
  @IsUUID()
  contadorId?: string | null;

  @IsOptional()
  @IsUUID()
  empresaId?: string | null;
}
