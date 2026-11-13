import { MaxLength, MinLength } from 'class-validator';

export class AtualizarComentarioDto {
  @MinLength(1)
  @MaxLength(2000)
  corpo!: string;
}
