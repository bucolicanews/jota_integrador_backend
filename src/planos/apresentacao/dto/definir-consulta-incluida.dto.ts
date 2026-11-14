import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PeriodoConsultaIncluida } from '../../aplicacao/portas/plano-consultas-incluidas-repositorio.port';

const PERIODOS: PeriodoConsultaIncluida[] = ['semanal', 'mensal', 'trimestral', 'semestral', 'anual'];

export class DefinirConsultaIncluidaDto {
  @IsInt()
  @Min(1)
  quantidadePorPeriodo!: number;

  @IsOptional()
  @IsIn(PERIODOS)
  periodo?: PeriodoConsultaIncluida;

  // Obrigatório pra todo periodo != semanal -- validação cruzada fica no usecase (precisa do
  // periodo resolvido, que aqui é opcional/default).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  diaDoMes?: number;

  // Mês do ciclo (trimestral 1-3, semestral 1-6, anual 1-12) -- validação de faixa por
  // periodo fica no usecase, aqui só garante inteiro positivo.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  mesDoPeriodo?: number;
}
