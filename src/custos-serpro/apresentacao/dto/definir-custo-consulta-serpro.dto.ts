import { IsNumber, Min } from 'class-validator';

export class DefinirCustoConsultaSerproDto {
  @IsNumber()
  @Min(0)
  custoReais!: number;
}
