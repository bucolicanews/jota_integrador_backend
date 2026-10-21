import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class IniciarCompraCreditoAvulsoDto {
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  pacoteId!: string;

  @IsEmail()
  customerEmail!: string;

  @IsOptional()
  @IsString()
  customerTelefoneE164?: string;
}
