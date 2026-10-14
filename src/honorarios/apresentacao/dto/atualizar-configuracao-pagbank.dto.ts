import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AtualizarConfiguracaoPagbankDto {
  @IsOptional()
  @IsString()
  accountId?: string | null;

  @IsOptional()
  @IsBoolean()
  sandbox?: boolean;

  @IsOptional()
  @IsBoolean()
  splitHabilitado?: boolean;
}
