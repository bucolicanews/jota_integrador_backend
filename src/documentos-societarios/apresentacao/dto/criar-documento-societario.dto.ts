import { IsDateString, IsObject, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CriarDocumentoSocietarioDto {
  @IsUUID()
  modeloId!: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @MinLength(1)
  titulo!: string;

  @IsObject()
  valoresTags!: Record<string, string>;

  @IsOptional()
  @IsDateString()
  dataRegistro?: string;
}
