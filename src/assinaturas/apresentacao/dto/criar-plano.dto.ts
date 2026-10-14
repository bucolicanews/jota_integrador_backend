import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Periodicidade } from '../../dominio/plano';
import { MODULOS_LICENCIAVEIS } from '../../../pacotes-modulos/dominio/pacote-modulos';

export class CriarPlanoDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsInt()
  @Min(0)
  operacoesIncluidas!: number;

  // Vitrine informativa (o que o plano anuncia) -- não gate de acesso, ver comment da
  // coluna planos.modulos na migration 20260913000004.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(MODULOS_LICENCIAVEIS, { each: true })
  modulos?: string[];

  @IsNumber()
  @Min(0)
  preco!: number;

  @IsIn(['mensal', 'anual'])
  periodicidade!: Periodicidade;

  @IsOptional()
  @IsDateString()
  dataValidade?: string | null;

  @IsOptional()
  @IsBoolean()
  gratuito?: boolean;
}
