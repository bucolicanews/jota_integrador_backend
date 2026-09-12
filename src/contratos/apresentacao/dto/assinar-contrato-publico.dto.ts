import { MinLength } from 'class-validator';

export class AssinarContratoPublicoDto {
  @MinLength(1)
  nome!: string;
}
