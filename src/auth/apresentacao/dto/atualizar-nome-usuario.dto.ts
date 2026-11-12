import { MaxLength, MinLength } from 'class-validator';

export class AtualizarNomeUsuarioDto {
  @MinLength(2)
  @MaxLength(200)
  nome!: string;
}
