import { IsEmail, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class IniciarPagamentoAssinaturaDto {
  @IsUUID()
  planoId!: string;

  @IsIn(['pix'])
  metodo!: 'pix';

  @IsEmail()
  customerEmail!: string;

  // Formato E.164 (+5511999998888) -- PagBank exige country/area/number separados,
  // convertidos na Application; sem telefone salvo, o campo é omitido (nunca inventado).
  @IsOptional()
  @IsString()
  customerTelefoneE164?: string;
}
