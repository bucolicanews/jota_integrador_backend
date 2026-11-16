import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { CATALOGO_ATIVIDADES_SERVICO, ChaveAtividadeServico } from '../../../apuracao-simples/dominio/catalogo-anexos-simples';

export class TransmitirDeclaracaoPgdasdDto {
  @IsOptional()
  @IsIn(Object.keys(CATALOGO_ATIVIDADES_SERVICO))
  chaveAtividadeServico?: ChaveAtividadeServico;

  @IsOptional()
  @IsDateString()
  dataConsolidacao?: string;
}
