import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { MODULOS_LICENCIAVEIS, Periodicidade } from '../../dominio/plano';

export class CriarPlanoDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  // Gate de acesso real (empresa_tem_modulo/empresa_modulos_liberados) -- toda empresa
  // com assinatura ativa deste plano tem esses módulos liberados de verdade (unificado em
  // 20261026000002_eliminar_licencas_modulo.sql, eliminando o sistema de licenças separado).
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
