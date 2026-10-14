import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class FiltroRelatorioConsultasSerproDto {
  @IsOptional()
  @IsUUID()
  contadorId?: string;

  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsString()
  idSistema?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;
}
