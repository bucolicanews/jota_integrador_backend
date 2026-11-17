import { IsOptional, IsUUID } from 'class-validator';

export class SalvarConfiguracaoLancamentosEsocialDto {
  @IsUUID()
  contaDespesaSalarioId!: string;

  @IsUUID()
  contaDespesaProLaboreId!: string;

  @IsUUID()
  contaDespesaInssId!: string;

  @IsUUID()
  contaPassivoInssId!: string;

  @IsUUID()
  contaPassivoSalarioAPagarId!: string;

  @IsUUID()
  contaPassivoProLaboreAPagarId!: string;

  @IsOptional()
  @IsUUID()
  contaDespesaFgtsId?: string;

  @IsOptional()
  @IsUUID()
  contaPassivoFgtsId?: string;
}
