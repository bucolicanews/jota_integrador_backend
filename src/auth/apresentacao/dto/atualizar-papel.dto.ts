import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { EscopoPapel } from '../../dominio/papel';

// Nome/escopo voltaram a ser editáveis em todo papel, inclusive os 7 de sistema (pedido
// explícito do usuário em 2026-11-12, revertendo a trava original da migration
// 20261108000002) -- risco de renomear/trocar escopo de um papel de sistema documentado
// em PapeisController.atualizar().
export class AtualizarPapelDto {
  @IsOptional()
  @MinLength(2)
  @MaxLength(60)
  nome?: string;

  @IsOptional()
  @IsIn(['plataforma', 'contador', 'empresa'])
  escopo?: EscopoPapel;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  permissaoIds?: string[];
}
