import { IsNumber, Min } from 'class-validator';

export class DefinirValorPorCreditoDto {
  @IsNumber()
  @Min(0.0001)
  valorPorCredito!: number;
}
