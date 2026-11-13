import { IsBoolean, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CriarColunaDto {
  @MinLength(1)
  @MaxLength(60)
  nome!: string;

  @IsOptional()
  @IsBoolean()
  ehFinal?: boolean;
}
