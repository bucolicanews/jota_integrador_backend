import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { MapeamentoColunasDto } from './mapeamento-colunas.dto';

export class SalvarConfiguracaoDto {
  @IsUUID()
  contaContabilId!: string;

  @MinLength(2)
  @MaxLength(100)
  nomeConfiguracao!: string;

  @ValidateNested()
  @Type(() => MapeamentoColunasDto)
  mapeamento!: MapeamentoColunasDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  colunaTipoTransacao?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  valorCredito?: string | null;
}
