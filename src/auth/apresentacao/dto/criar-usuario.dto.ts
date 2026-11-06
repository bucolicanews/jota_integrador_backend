import {
  IsEmail,
  IsEnum,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ESCOPO_POR_PAPEL, Papel } from '../../dominio/papel';

// `@IsUUID()` do class-validator rejeita o id sentinela 'Jota Contabilidade'
// (00000000-0000-0000-0000-000000000001 -- dígito de versão '0', fora de 1-5) -- mesmo
// ajuste já feito em transferir-carteira-empresa.dto.ts. Formato solto (8-4-4-4-12 hex),
// a existência de verdade é garantida pela FK (23503 tratado no repositório).
const REGEX_UUID_SOLTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ValidatorConstraint({ name: 'coerenciaEscopoPapel', async: false })
class CoerenciaEscopoPapelConstraint implements ValidatorConstraintInterface {
  validate(papel: Papel, args: ValidationArguments): boolean {
    const dto = args.object as CriarUsuarioDto;
    const escopo = ESCOPO_POR_PAPEL[papel];

    if (escopo === 'plataforma') {
      return !dto.contadorId && !dto.empresaId;
    }
    if (escopo === 'contador') {
      return Boolean(dto.contadorId) && !dto.empresaId;
    }
    return Boolean(dto.empresaId) && !dto.contadorId; // escopo === 'empresa'
  }

  defaultMessage(): string {
    return 'contadorId/empresaId precisam bater com o escopo do papel informado (ver docs/BANCO_DE_DADOS.md §1)';
  }
}

// DTO com whitelist explícita de campos -- nunca aceitar o body inteiro (regra de mass
// assignment já documentada no PENTEST_CODE_REVIEW_PROTOCOL.md do vault).
export class CriarUsuarioDto {
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsEnum(Papel)
  @Validate(CoerenciaEscopoPapelConstraint)
  papel!: Papel;

  @IsOptional()
  @Matches(REGEX_UUID_SOLTO, { message: 'contadorId deve ser um identificador válido' })
  contadorId?: string | null;

  @IsOptional()
  @Matches(REGEX_UUID_SOLTO, { message: 'empresaId deve ser um identificador válido' })
  empresaId?: string | null;
}
