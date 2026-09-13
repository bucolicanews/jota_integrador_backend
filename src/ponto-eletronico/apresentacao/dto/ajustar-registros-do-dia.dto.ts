import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, ValidateNested } from 'class-validator';

class BatidaAjustadaDto {
  @IsIn(['entrada', 'saida'])
  tipo!: 'entrada' | 'saida';

  @IsDateString()
  horario!: string;
}

export class AjustarRegistrosDoDiaDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BatidaAjustadaDto)
  batidas!: BatidaAjustadaDto[];
}
