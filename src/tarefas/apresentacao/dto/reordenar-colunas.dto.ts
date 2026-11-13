import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReordenarColunasDto {
  /** Já vem na ordem nova desejada -- a posição no array é o `ordem`. */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  colunaIds!: string[];
}
