import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class MapeamentoColunasDto {
  @MinLength(1)
  @MaxLength(100)
  data!: string;

  @MinLength(1)
  @MaxLength(100)
  descricao!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  valor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  credito?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  debito?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  identificacao?: string | null;
}
