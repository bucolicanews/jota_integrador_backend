import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class MoverTarefaDto {
  @IsUUID()
  colunaId!: string;

  @IsInt()
  @Min(0)
  ordem!: number;

  /** Quem ficou responsável nessa etapa específica -- opcional, pode mudar a cada movimentação. */
  @IsOptional()
  @IsUUID()
  responsavelId?: string | null;
}
