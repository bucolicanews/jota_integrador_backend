import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegistrarExtratoManualDto {
  @IsUUID()
  contaContabilId!: string;

  @IsUUID()
  contaContabilResultadoId!: string;

  @IsIn(['Entrada', 'Saida'])
  tipo!: 'Entrada' | 'Saida';

  @IsNumber()
  @IsPositive()
  valor!: number;

  @IsDateString()
  dataCompetencia!: string;

  @MinLength(1)
  @MaxLength(500)
  descricao!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  identificacao?: string;
}
