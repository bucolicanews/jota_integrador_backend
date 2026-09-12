import { MaxLength, MinLength } from 'class-validator';

export class AtualizarPerfilProprioDto {
  @MinLength(2)
  @MaxLength(200)
  nome!: string;
}
