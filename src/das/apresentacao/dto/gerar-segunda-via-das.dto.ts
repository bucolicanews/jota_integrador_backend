import { IsDateString, IsOptional } from 'class-validator';

export class GerarSegundaViaDasDto {
  /** Até quando o boleto fica válido pra pagar (SERPRO exige estritamente futura) -- default calculado no backend se omitido. */
  @IsOptional()
  @IsDateString()
  dataConsolidacao?: string;
}
