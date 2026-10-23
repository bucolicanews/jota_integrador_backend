import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AtualizarPlanoRevendaCreditoAvulsoDto {
  @IsOptional()
  @IsString()
  nome?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  valorVenda?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
