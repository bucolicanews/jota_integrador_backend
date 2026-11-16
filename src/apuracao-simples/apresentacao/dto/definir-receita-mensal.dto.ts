import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { TipoAtividadeReceita } from '../../dominio/receita-mensal';

export class DefinirReceitaMensalDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-01$/, { message: 'competencia precisa ser AAAA-MM-01' })
  competencia!: string;

  @IsIn(['comercio_industria', 'servico'])
  tipoAtividade!: TipoAtividadeReceita;

  @IsNumber()
  @Min(0)
  valor!: number;

  @IsOptional()
  @IsBoolean()
  issRetidoNaFonte?: boolean;

  @IsOptional()
  @IsBoolean()
  issDevidoAOutroMunicipio?: boolean;
}
