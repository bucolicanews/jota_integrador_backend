import { IsDateString, MinLength } from 'class-validator';

export class RegistrarEntregaProtocoloDto {
  @MinLength(3)
  nomeRespRecebimento!: string;

  @IsDateString()
  dataRecebimento!: string;
}
