import { IsString, MinLength } from 'class-validator';

export class ConfirmarTotp2faDto {
  @IsString()
  @MinLength(10)
  factorId!: string;
}
