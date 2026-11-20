import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejeitarNotaServicoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivoRejeicao!: string;
}
