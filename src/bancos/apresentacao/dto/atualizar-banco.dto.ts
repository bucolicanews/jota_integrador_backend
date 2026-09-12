import { IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AtualizarBancoDto {
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsUUID()
  contaContabilId?: string;
}
