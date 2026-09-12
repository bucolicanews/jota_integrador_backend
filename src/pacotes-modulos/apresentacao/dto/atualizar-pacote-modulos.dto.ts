import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { MODULOS_LICENCIAVEIS } from '../../dominio/pacote-modulos';

export class AtualizarPacoteModulosDto {
  @IsOptional()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(MODULOS_LICENCIAVEIS, { each: true })
  modulos?: string[];

  @IsOptional()
  @IsNumber()
  @IsPositive()
  preco?: number;

  @IsOptional()
  @IsIn(['mensal', 'anual'])
  periodicidade?: 'mensal' | 'anual';
}
