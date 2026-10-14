import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { MODULOS_LICENCIAVEIS } from '../../dominio/pacote-modulos';

export class AtualizarPacoteModulosDto {
  @IsOptional()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(MODULOS_LICENCIAVEIS, { each: true })
  modulos?: string[];

  // Positivo só é exigido pelo usecase quando gratuito=false (validarPrecoGratuito) --
  // aqui só garante não-negativo, pra permitir preco=0 em pacote grátis.
  @IsOptional()
  @IsNumber()
  @Min(0)
  preco?: number;

  @IsOptional()
  @IsIn(['mensal', 'anual'])
  periodicidade?: 'mensal' | 'anual';

  @IsOptional()
  @IsDateString()
  dataValidade?: string | null;

  @IsOptional()
  @IsBoolean()
  gratuito?: boolean;
}
