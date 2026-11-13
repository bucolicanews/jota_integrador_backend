import { MaxLength, MinLength } from 'class-validator';

export class AtualizarQuadroDto {
  @MinLength(1)
  @MaxLength(60)
  nome!: string;
}
