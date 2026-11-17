import { Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ArquivoRemuneracaoDto {
  @IsString()
  xml!: string;

  /** Omitido = backend tenta inferir pelo codCateg do XML -- ver inferirClassificacaoPorCodCateg. */
  @IsOptional()
  @IsIn(['funcionario', 'pro_labore'])
  classificacao?: 'funcionario' | 'pro_labore';
}

export class ImportarRemuneracaoEsocialDto {
  @ValidateNested({ each: true })
  @Type(() => ArquivoRemuneracaoDto)
  @ArrayMinSize(1)
  arquivos!: ArquivoRemuneracaoDto[];

  @IsBoolean()
  confirmar!: boolean;
}
