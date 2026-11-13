import { IsBoolean, IsIn, IsOptional, MaxLength, MinLength } from 'class-validator';

export class AtualizarContaContabilDto {
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsBoolean()
  sintetica?: boolean;

  @IsOptional()
  @IsBoolean()
  contaCaixaBanco?: boolean;

  @IsOptional()
  @IsIn(['caixa', 'banco', 'outra'])
  tipoCaixaBanco?: 'caixa' | 'banco' | 'outra';

  @IsOptional()
  @IsBoolean()
  contaAReceber?: boolean;

  @IsOptional()
  @IsBoolean()
  contaAPagar?: boolean;
}
