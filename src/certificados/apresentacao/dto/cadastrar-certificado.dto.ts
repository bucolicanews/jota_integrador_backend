import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { TipoCertificado } from '../../dominio/certificado';

export class CadastrarCertificadoDto {
  @IsIn(['A1', 'A3'])
  tipo!: TipoCertificado;

  // Nunca logada nem retornada -- só passa por aqui a caminho do CofreCriptografiaService.
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  senha!: string;

  // validadeInicio/validadeFim não são mais input do cliente -- extraídas de verdade do
  // .pfx (extrairValidadeDoPfx), nunca digitadas (ver cadastrar-ou-rotacionar-certificado.usecase.ts).
}
