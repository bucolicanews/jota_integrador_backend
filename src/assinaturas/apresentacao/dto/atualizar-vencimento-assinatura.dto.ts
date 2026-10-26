import { IsISO8601, IsOptional } from 'class-validator';

export class AtualizarVencimentoAssinaturaDto {
  // Ausente/null = remove vencimento (assinatura não expira, ex: cortesia).
  @IsOptional()
  @IsISO8601()
  fimEm?: string | null;
}
