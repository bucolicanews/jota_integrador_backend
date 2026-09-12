import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class AtualizarDocumentoSocietarioDto {
  @IsOptional()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @IsString()
  conteudoPrincipalManual?: string;

  @IsOptional()
  @IsDateString()
  dataRegistro?: string;
}
