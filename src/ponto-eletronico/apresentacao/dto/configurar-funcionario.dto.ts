import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, Min } from 'class-validator';

const DIAS_SEMANA_VALIDOS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

export class ConfigurarFuncionarioDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  salario?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  horasMensais?: number;

  @IsOptional()
  @IsArray()
  @IsIn(DIAS_SEMANA_VALIDOS, { each: true })
  diasFolgaFixos?: string[];

  @IsOptional()
  @IsBoolean()
  folgaDomingoObrigatoria?: boolean;

  @IsOptional()
  @IsDateString()
  dataInicioContrato?: string;
}
