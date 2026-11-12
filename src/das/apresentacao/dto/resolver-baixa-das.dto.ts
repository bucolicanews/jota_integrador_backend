import { IsIn, IsUUID } from 'class-validator';

export class ResolverBaixaDasDto {
  @IsIn(['caixa', 'banco'])
  tipo!: 'caixa' | 'banco';

  @IsUUID()
  bancoId!: string;
}
