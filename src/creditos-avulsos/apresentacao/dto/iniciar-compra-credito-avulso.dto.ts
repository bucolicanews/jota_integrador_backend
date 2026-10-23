import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';

export class IniciarCompraCreditoAvulsoDto {
  /** @default 'pix' */
  @IsOptional()
  @IsIn(['pix', 'cartao'])
  metodo?: 'pix' | 'cartao';

  /** Obrigatório quando metodo='cartao' -- PagSeguro.encryptCard() no navegador. */
  @IsOptional()
  @IsString()
  cardEncrypted?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;

  /** Exatamente um dos três (validado no usecase): pacote direto da plataforma (sem split). */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  pacoteId?: string;

  /** Pacote de revenda de um contador específico (com split). */
  @IsOptional()
  @IsUUID()
  planoRevendaId?: string;

  /** Quantidade livre (sem split) -- quantidade * valorPorCredito configurado pelo admin. */
  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;

  @IsEmail()
  customerEmail!: string;

  @IsOptional()
  @IsString()
  customerTelefoneE164?: string;
}
