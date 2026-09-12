import { IsIn, IsUUID } from 'class-validator';

export class VincularParcelaDto {
  @IsUUID()
  parcelaId!: string;

  @IsIn(['CP', 'CR'])
  tipo!: 'CP' | 'CR';
}
