import { IsString, Length } from 'class-validator';

export class VerificarCodigoEmail2faDto {
  @IsString()
  @Length(6, 6)
  codigo!: string;
}
