import { IsString, MinLength } from 'class-validator';

export class AtualizarPagbankContaDto {
  @IsString()
  @MinLength(1)
  pagbankAccountId!: string;
}
