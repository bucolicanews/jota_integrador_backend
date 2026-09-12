import { IsIn } from 'class-validator';

export class AvancarStatusProtocoloDto {
  @IsIn(['impresso', 'transito'])
  status!: 'impresso' | 'transito';
}
