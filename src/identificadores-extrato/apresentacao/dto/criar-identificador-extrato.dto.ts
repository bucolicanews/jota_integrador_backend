import { MaxLength, MinLength } from 'class-validator';

export class CriarIdentificadorExtratoDto {
  @MinLength(1)
  @MaxLength(300)
  descricao!: string;
}
