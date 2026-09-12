import { IsUUID, MaxLength, MinLength } from 'class-validator';

export class CriarBancoDto {
  @MinLength(1)
  @MaxLength(200)
  nome!: string;

  @IsUUID()
  contaContabilId!: string;
}
