import { MinLength } from 'class-validator';

export class EstornarRecebimentoDto {
  @MinLength(2)
  motivo!: string;
}
