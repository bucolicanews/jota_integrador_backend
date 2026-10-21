import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { MODULOS_LICENCIAVEIS } from '../../../pacotes-modulos/dominio/pacote-modulos';

export class AtualizarPlanoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(MODULOS_LICENCIAVEIS, { each: true })
  modulos?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  preco?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsDateString()
  dataValidade?: string | null;

  @IsOptional()
  @IsBoolean()
  gratuito?: boolean;
}
