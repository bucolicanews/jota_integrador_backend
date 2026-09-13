import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class LancarFolgaTrabalhadaDto {
  @IsUUID()
  usuarioAlvoId!: string;

  @IsDateString()
  data!: string;

  @IsIn(['extra100', 'compensacao'])
  decisao!: 'extra100' | 'compensacao';

  @IsOptional()
  @IsDateString()
  dataCompensacaoFutura?: string;
}
