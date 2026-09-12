import { IsOptional, MinLength } from 'class-validator';

export class CriarBlocoSocietarioDto {
  @MinLength(1)
  titulo!: string;

  @MinLength(1)
  conteudo!: string;

  @IsOptional()
  @MinLength(1)
  tipoBloco?: string;
}
