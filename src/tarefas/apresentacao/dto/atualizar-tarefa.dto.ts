import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PrioridadeTarefa } from '../../aplicacao/portas/tarefas-repositorio.port';

export class AtualizarTarefaDto {
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsUUID()
  atribuidoA?: string | null;

  @IsOptional()
  @IsIn(['baixa', 'media', 'alta'])
  prioridade?: PrioridadeTarefa;

  @IsOptional()
  @IsDateString()
  prazo?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999)
  tempoEstimadoHoras?: number | null;
}
