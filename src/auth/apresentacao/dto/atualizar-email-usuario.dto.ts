import { IsEmail, MaxLength } from 'class-validator';

export class AtualizarEmailUsuarioDto {
  @IsEmail()
  @MaxLength(200)
  novoEmail!: string;
}
