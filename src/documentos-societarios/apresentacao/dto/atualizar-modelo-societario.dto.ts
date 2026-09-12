import { IsIn, IsOptional, MinLength } from 'class-validator';

export class AtualizarModeloSocietarioDto {
  @IsOptional()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @MinLength(1)
  conteudoTemplate?: string;

  @IsOptional()
  @MinLength(1)
  tipoDocumento?: string;

  @IsOptional()
  @IsIn(['html', 'texto'])
  tipoConteudo?: 'html' | 'texto';
}
