import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsUUID, Max, Min, MinLength } from 'class-validator';
import { MODOS_PARCELAMENTO, ModoParcelamento } from '../../dominio/conta-pagar';

export class CriarContaPagarDto {
  @IsOptional()
  @IsUUID()
  fornecedorId?: string;

  @MinLength(1)
  fornecedor!: string;

  @MinLength(1)
  descricao!: string;

  @IsUUID()
  contaPatrimonialId!: string;

  @IsUUID()
  contaResultadoId!: string;

  @IsDateString()
  dataEmissao!: string;

  @IsIn(MODOS_PARCELAMENTO)
  modo!: ModoParcelamento;

  @IsNumber()
  @IsPositive()
  valor!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(360)
  quantidadeParcelas?: number;

  @IsDateString()
  primeiroVencimento!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  intervaloDias?: number;
}
