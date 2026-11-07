import { IsString, MinLength } from 'class-validator';

export class AtualizarSenhaUsuarioDto {
  @IsString()
  @MinLength(9) // mesmo mínimo exigido pelo provedor (GoTrue) -- feedback cedo, antes do round-trip.
  novaSenha!: string;
}
