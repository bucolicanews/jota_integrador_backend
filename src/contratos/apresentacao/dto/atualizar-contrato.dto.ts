import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class AtualizarContratoDto {
  @IsOptional()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @IsObject()
  valoresTags?: Record<string, string>;

  @IsOptional()
  @IsString()
  conteudoRenderizado?: string;
}
