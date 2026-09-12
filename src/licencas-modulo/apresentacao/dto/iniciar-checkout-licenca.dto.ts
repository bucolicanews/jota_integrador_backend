import { IsUUID, IsUrl } from 'class-validator';

export class IniciarCheckoutLicencaDto {
  @IsUUID()
  pacoteId!: string;

  @IsUrl({ require_tld: false })
  successUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}
