import { IsInt, Min } from 'class-validator';

export class DefinirConsultaIncluidaDto {
  @IsInt()
  @Min(1)
  quantidadePorPeriodo!: number;
}
