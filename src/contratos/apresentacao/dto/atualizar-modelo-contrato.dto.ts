import { IsIn, IsOptional, MinLength } from 'class-validator';

export class AtualizarModeloContratoDto {
  @IsOptional()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @MinLength(1)
  conteudoTemplate?: string;

  @IsOptional()
  @IsIn(['html', 'texto'])
  tipoConteudo?: 'html' | 'texto';
}
