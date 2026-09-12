import { IsIn, MinLength } from 'class-validator';

export class CancelarProblemaProtocoloDto {
  @IsIn(['cancelado', 'problema'])
  status!: 'cancelado' | 'problema';

  @MinLength(3)
  observacao!: string;
}
