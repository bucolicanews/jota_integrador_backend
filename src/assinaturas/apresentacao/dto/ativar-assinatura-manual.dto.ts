import { IsOptional, IsUUID } from 'class-validator';

export class AtivarAssinaturaManualDto {
  @IsUUID()
  planoId!: string;

  // Null/ausente = ativação sem plano de revenda específico (ex: plano grátis).
  @IsOptional()
  @IsUUID()
  planoRevendaId?: string;
}
