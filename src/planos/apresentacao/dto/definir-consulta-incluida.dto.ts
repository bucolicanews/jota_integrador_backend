import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PeriodoConsultaIncluida } from '../../aplicacao/portas/plano-consultas-incluidas-repositorio.port';

const PERIODOS: PeriodoConsultaIncluida[] = ['semanal', 'mensal', 'trimestral', 'anual'];

export class DefinirConsultaIncluidaDto {
  @IsInt()
  @Min(1)
  quantidadePorPeriodo!: number;

  @IsOptional()
  @IsIn(PERIODOS)
  periodo?: PeriodoConsultaIncluida;
}
