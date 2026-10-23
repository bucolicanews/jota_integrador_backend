import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CriarPlanoRevendaCreditoAvulsoDto {
  @IsUUID()
  pacoteId!: string;

  @IsOptional()
  @IsString()
  nome?: string | null;

  @IsNumber()
  @Min(0.01)
  valorVenda!: number;
}
