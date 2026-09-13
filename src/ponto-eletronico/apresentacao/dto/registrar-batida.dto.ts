import { IsNumberString, IsOptional } from 'class-validator';

export class RegistrarBatidaDto {
  @IsOptional()
  @IsNumberString()
  latitude?: string;

  @IsOptional()
  @IsNumberString()
  longitude?: string;
}
