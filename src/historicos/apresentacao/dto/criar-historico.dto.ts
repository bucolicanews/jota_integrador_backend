import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarHistoricoDto {
  @IsOptional() @IsString() @MaxLength(20) codigo?: string;

  @MinLength(2)
  @MaxLength(500)
  descricao!: string;
}
