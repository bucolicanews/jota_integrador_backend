import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SalvarConfiguracaoContratosDto {
  @IsOptional()
  @IsUUID()
  contaPatrimonialReceberId?: string;

  @IsOptional()
  @IsUUID()
  contaResultadoReceitaId?: string;

  @IsOptional()
  @IsUUID()
  contaPatrimonialPagarId?: string;

  @IsOptional()
  @IsUUID()
  contaResultadoDespesaId?: string;

  @IsOptional()
  @IsString()
  urlBaseAssinatura?: string;
}
