import { IsOptional, IsUUID } from 'class-validator';

export class SalvarConfiguracaoLancamentosNfDto {
  @IsUUID()
  contaPatrimonialEntradaId!: string;

  @IsUUID()
  contaResultadoEntradaId!: string;

  @IsUUID()
  contaPatrimonialSaidaId!: string;

  @IsUUID()
  contaResultadoSaidaId!: string;

  /** Opcional -- null/ausente desativa a baixa automática de NFCe em dinheiro à vista. */
  @IsOptional()
  @IsUUID()
  contaRecebimentoVistaId?: string | null;
}
