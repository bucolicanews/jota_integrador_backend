import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SalvarConfiguracaoContratosDto {
  @IsOptional()
  @IsUUID()
  contaPatrimonialReceberId?: string;

  @IsOptional()
  @IsUUID()
  contaResultadoReceitaId?: string;

  @IsOptional()
  @IsString()
  urlBaseAssinatura?: string;
}
