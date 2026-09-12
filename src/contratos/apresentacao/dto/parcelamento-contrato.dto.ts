import { IsDateString, IsIn, IsInt, IsNumber, IsPositive, Max, Min } from 'class-validator';
import { MODOS_PARCELAMENTO, ModoParcelamento } from '../../../contas-a-receber/dominio/conta-receber';

export class ParcelamentoContratoDto {
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

export class MudancaFinanceiraAditivoDto extends ParcelamentoContratoDto {
  @IsNumber()
  @IsPositive()
  valorTotalNovo!: number;
}
