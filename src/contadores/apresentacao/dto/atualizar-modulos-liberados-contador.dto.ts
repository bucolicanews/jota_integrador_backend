import { IsArray, IsString } from 'class-validator';

export class AtualizarModulosLiberadosContadorDto {
  @IsArray()
  @IsString({ each: true })
  modulos!: string[];
}
