import { IsNumber, Max, Min } from 'class-validator';

export class AtualizarComissaoContratosDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  comissaoContratosPct!: number;
}
