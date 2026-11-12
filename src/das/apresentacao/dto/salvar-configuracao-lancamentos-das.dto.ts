import { IsUUID } from 'class-validator';

export class SalvarConfiguracaoLancamentosDasDto {
  @IsUUID()
  contaDebitoId!: string;

  @IsUUID()
  contaCreditoId!: string;
}
