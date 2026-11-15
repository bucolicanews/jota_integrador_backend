import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejeitarNotaFiscalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivoRejeicao!: string;
}
