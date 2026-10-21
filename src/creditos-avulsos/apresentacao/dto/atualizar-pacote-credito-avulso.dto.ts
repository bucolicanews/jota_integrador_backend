import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class AtualizarPacoteCreditoAvulsoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeCreditos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  precoReais?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
