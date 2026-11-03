import { IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class CriarCobrancaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  descricao!: string;

  @IsNumber()
  @Min(0.01)
  valor!: number;

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

  @IsOptional()
  @IsString()
  customerTelefoneE164?: string;
}
