import { IsOptional, MaxLength, MinLength } from 'class-validator';

export class AtualizarIdentificadorExtratoDto {
  @IsOptional()
  @MinLength(1)
  @MaxLength(300)
  descricao?: string;
}
