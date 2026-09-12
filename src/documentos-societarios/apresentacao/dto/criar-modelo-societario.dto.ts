import { IsIn, MinLength } from 'class-validator';

export class CriarModeloSocietarioDto {
  @MinLength(1)
  titulo!: string;

  @MinLength(1)
  conteudoTemplate!: string;

  @MinLength(1)
  tipoDocumento!: string;

  @IsIn(['html', 'texto'])
  tipoConteudo!: 'html' | 'texto';
}
