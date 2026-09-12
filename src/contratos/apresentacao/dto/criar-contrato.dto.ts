import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsPositive, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { ParcelamentoContratoDto } from './parcelamento-contrato.dto';

export class CriarContratoDto {
  @IsUUID()
  modeloId!: string;

  // Exatamente um dos dois -- checado no UseCase (BadRequestException), decorators só
  // validam formato quando o campo vem preenchido.
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsUUID()
  empresaContraparteId?: string;

  @MinLength(1)
  titulo!: string;

  @IsObject()
  valoresTagsManuais!: Record<string, string>;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  valorTotal?: number;

  // Obrigatório quando valorTotal é informado -- checado no UseCase (BadRequestException),
  // não dá pra expressar "obrigatório condicional" limpo com decorators só.
  @IsOptional()
  @ValidateNested()
  @Type(() => ParcelamentoContratoDto)
  parcelamento?: ParcelamentoContratoDto;
}
