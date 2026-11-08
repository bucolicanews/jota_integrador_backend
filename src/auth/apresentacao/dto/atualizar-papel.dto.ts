import { ArrayUnique, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// Nome/escopo são imutáveis depois de criado (mudar o escopo de um papel já em uso por
// algum usuário quebraria a coerência escopo×vínculo validada na criação) -- só descrição
// e teto de permissões são editáveis.
export class AtualizarPapelDto {
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
