import { IsDateString, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class RegistrarRecebimentoDto {
  @IsUUID()
  contaBancariaId!: string;

  @IsNumber()
  @IsPositive()
  valorRecebido!: number;

  @IsDateString()
  dataRecebimento!: string;
}
