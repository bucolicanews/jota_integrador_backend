import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AtualizarHistoricoDto {
  @IsOptional() @IsString() @MaxLength(20) codigo?: string;
  @IsOptional() @MinLength(2) @MaxLength(500) descricao?: string;
}
