import { IsOptional, MinLength } from 'class-validator';

export class AtualizarBlocoSocietarioDto {
  @IsOptional()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @MinLength(1)
  conteudo?: string;

  @IsOptional()
  @MinLength(1)
  tipoBloco?: string;
}
