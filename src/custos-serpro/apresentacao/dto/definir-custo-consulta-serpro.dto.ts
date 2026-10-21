import { IsNumber, IsOptional, Min } from 'class-validator';

export class DefinirCustoConsultaSerproDto {
  @IsNumber()
  @Min(0)
  custoReais!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoVendaReais?: number;
}
