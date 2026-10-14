import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CriarPlanoRevendaCreditoDto {
  @IsUUID()
  planoId!: string;

  @IsOptional()
  @IsString()
  nome?: string | null;

  @IsNumber()
  @Min(0.01)
  valorVenda!: number;
}
