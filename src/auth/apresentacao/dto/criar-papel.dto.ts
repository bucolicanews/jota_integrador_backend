import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { EscopoPapel } from '../../dominio/papel';

// DTO com whitelist explícita de campos (mesmo princípio de criar-usuario.dto.ts) --
// `permissaoIds` vira o teto inicial (papel_permissoes) desse papel novo, validado contra
// o catálogo de verdade no repositório (FK), não aqui.
export class CriarPapelDto {
  @MinLength(2)
  @MaxLength(60)
  nome!: string;

  @IsIn(['plataforma', 'contador', 'empresa'])
  escopo!: EscopoPapel;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  permissaoIds?: string[];
}
