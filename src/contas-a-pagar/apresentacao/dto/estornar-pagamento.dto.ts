import { MinLength } from 'class-validator';

export class EstornarPagamentoDto {
  @MinLength(2)
  motivo!: string;
}
