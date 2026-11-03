import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class IniciarPagamentoAssinaturaDto {
  @IsUUID()
  planoId!: string;

  @IsIn(['pix', 'cartao'])
  metodo!: 'pix' | 'cartao';

  /** Obrigatório quando metodo='cartao' -- PagSeguro.encryptCard() no navegador, nunca número/CVV em texto puro. */
  @IsOptional()
  @IsString()
  cardEncrypted?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;

  @IsEmail()
  customerEmail!: string;

  // Formato E.164 (+5511999998888) -- PagBank exige country/area/number separados,
  // convertidos na Application; sem telefone salvo, o campo é omitido (nunca inventado).
  @IsOptional()
  @IsString()
  customerTelefoneE164?: string;
}
