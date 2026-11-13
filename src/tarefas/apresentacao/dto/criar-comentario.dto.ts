import { MaxLength, MinLength } from 'class-validator';

export class CriarComentarioDto {
  @MinLength(1)
  @MaxLength(2000)
  corpo!: string;
}
