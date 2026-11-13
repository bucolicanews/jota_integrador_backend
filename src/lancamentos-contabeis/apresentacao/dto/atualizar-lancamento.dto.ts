import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { PartidaLancamentoDto } from './partida-lancamento.dto';

export class AtualizarLancamentoDto {
  @IsDateString()
  dataCompetencia!: string;

  @MinLength(2)
  @MaxLength(500)
  historico!: string;

  // Mesma regra de CriarLancamentoDto: validação de "débito soma igual a crédito"
  // acontece no banco (atualizar_lancamento_contabil), aqui só a forma dos dados.
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PartidaLancamentoDto)
  partidas!: PartidaLancamentoDto[];
}
