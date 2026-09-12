import { IsInt, IsNumber, IsObject, IsOptional, IsPositive, IsUUID, Min } from 'class-validator';

export class PreVisualizarContratoDto {
  @IsUUID()
  modeloId!: string;

  @IsUUID()
  clienteId!: string;

  @IsObject()
  valoresTagsManuais!: Record<string, string>;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  valorTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeParcelas?: number;
}
