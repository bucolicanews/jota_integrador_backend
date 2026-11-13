import { IsBoolean, IsIn, IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';
import { GRUPOS_CONTA_CONTABIL, GrupoContaContabil } from '../../dominio/plano-conta';

export class CriarContaContabilDto {
  @MinLength(1)
  @MaxLength(30)
  codigo!: string;

  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @IsIn(GRUPOS_CONTA_CONTABIL)
  grupo!: GrupoContaContabil;

  @IsBoolean()
  sintetica!: boolean;

  @IsOptional()
  @IsUUID()
  contaPaiId?: string | null;

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
