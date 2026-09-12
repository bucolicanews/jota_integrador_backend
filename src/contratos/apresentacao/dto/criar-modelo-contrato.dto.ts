import { IsIn, MinLength } from 'class-validator';

export class CriarModeloContratoDto {
  @MinLength(1)
  titulo!: string;

  @MinLength(1)
  conteudoTemplate!: string;

  @IsIn(['html', 'texto'])
  tipoConteudo!: 'html' | 'texto';
}
