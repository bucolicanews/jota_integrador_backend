import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CriarFeriasDto {
  @IsUUID()
  usuarioAlvoId!: string;

  @IsDateString()
  dataInicio!: string;

  @IsDateString()
  dataFim!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  periodoReferencia?: string;
}
