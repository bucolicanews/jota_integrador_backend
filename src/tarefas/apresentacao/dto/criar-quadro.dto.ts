import { MaxLength, MinLength } from 'class-validator';

export class CriarQuadroDto {
  @MinLength(1)
  @MaxLength(60)
  nome!: string;
}
