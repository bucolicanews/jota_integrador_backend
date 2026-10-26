import { IsOptional, IsDateString } from 'class-validator';

/** Intervalo de competência opcional -- sem os dois, cai na janela padrão de 3 meses (ver MESES_JANELA_SINCRONIZACAO). */
export class SincronizarDasDto {
  @IsOptional()
  @IsDateString()
  competenciaInicio?: string;

  @IsOptional()
  @IsDateString()
  competenciaFim?: string;
}
