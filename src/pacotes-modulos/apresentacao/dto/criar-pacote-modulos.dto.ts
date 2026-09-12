import { ArrayMinSize, IsArray, IsIn, IsNumber, IsPositive, IsString, MinLength } from 'class-validator';
import { MODULOS_LICENCIAVEIS } from '../../dominio/pacote-modulos';

export class CriarPacoteModulosDto {
  @MinLength(1)
  nome!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(MODULOS_LICENCIAVEIS, { each: true })
  modulos!: string[];

  @IsNumber()
  @IsPositive()
  preco!: number;

  @IsIn(['mensal', 'anual'])
  periodicidade!: 'mensal' | 'anual';
}
