import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsUUID, Min } from 'class-validator';

// multipart/form-data -- campos numéricos chegam como string, @Type() força a conversão
// antes da validação (o global ValidationPipe não faz conversão implícita).
export class LancarFaltaAbonoDto {
  @IsUUID()
  usuarioAlvoId!: string;

  @IsDateString()
  data!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  horasFalta!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  horasAbono!: number;
}
