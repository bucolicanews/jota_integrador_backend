import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AtualizarPagbankContaEmpresaDto {
  @IsOptional()
  @IsString()
  pagbankAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  bancoPagbankId?: string | null;

  @IsOptional()
  @IsUUID()
  contaContabilPagbankId?: string | null;
}
