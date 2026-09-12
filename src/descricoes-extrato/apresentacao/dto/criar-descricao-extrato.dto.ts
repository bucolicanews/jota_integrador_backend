import { MaxLength, MinLength } from 'class-validator';

export class CriarDescricaoExtratoDto {
  @MinLength(1)
  @MaxLength(300)
  descricao!: string;
}
