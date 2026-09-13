import { MinLength } from 'class-validator';

export class EnviarMensagemDto {
  @MinLength(1)
  conteudo!: string;
}
