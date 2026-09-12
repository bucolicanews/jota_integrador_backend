import { IsDateString, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class RegistrarPagamentoDto {
  @IsUUID()
  contaBancariaId!: string;

  @IsNumber()
  @IsPositive()
  valorPago!: number;

  @IsDateString()
  dataPagamento!: string;
}
