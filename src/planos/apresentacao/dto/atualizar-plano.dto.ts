import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { MODULOS_LICENCIAVEIS, Periodicidade } from '../../dominio/plano';

export class AtualizarPlanoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(MODULOS_LICENCIAVEIS, { each: true })
  modulos?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  preco?: number;

  // Afeta o cálculo de renovação de assinaturas já ativas desse plano daqui pra frente
  // (ProcessarWebhookPagbankCreditosUseCase lê o periodicidade do plano a cada renovação,
  // nunca congela no momento da assinatura) -- mesmo risco que `preco` já tem, nenhum
  // guard extra por consistência.
  @IsOptional()
  @IsIn(['mensal', 'anual'])
  periodicidade?: Periodicidade;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsDateString()
  dataValidade?: string | null;

  @IsOptional()
  @IsBoolean()
  gratuito?: boolean;
}
