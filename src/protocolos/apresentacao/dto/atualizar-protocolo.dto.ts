import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AtualizarProtocoloDto {
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @MinLength(1)
  @MaxLength(300)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkTarefa?: string;
}
