import { Type } from 'class-transformer';
import { IsOptional, MinLength, ValidateNested } from 'class-validator';
import { MudancaFinanceiraAditivoDto } from './parcelamento-contrato.dto';

export class RegistrarAditivoDto {
  @MinLength(1)
  descricao!: string;

  // Ausente = aditivo só documenta mudança não-financeira (prazo, cláusula) -- não mexe em contas_receber.
  @IsOptional()
  @ValidateNested()
  @Type(() => MudancaFinanceiraAditivoDto)
  mudancaFinanceira?: MudancaFinanceiraAditivoDto;
}
