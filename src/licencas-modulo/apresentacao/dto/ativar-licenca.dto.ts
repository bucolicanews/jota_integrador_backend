import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { MODOS_PARCELAMENTO, ModoParcelamento } from '../../../contas-a-receber/dominio/conta-receber';

export class ParcelamentoAtivacaoDto {
  @IsIn(MODOS_PARCELAMENTO)
  modo!: ModoParcelamento;

  @IsInt()
  @Min(1)
  @Max(360)
  quantidadeParcelas!: number;

  @IsDateString()
  primeiroVencimento!: string;

  @IsInt()
  @Min(1)
  @Max(365)
  intervaloDias!: number;
}

export class AtivarLicencaDto {
  @IsUUID()
  empresaId!: string;

  // Ausente/null = ativa sem cobrar dessa vez -- contador decide o valor, pode ser 0.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  valorCobrado?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ParcelamentoAtivacaoDto)
  parcelamento?: ParcelamentoAtivacaoDto;
}
