import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Enviado como multipart junto do arquivo -- campos de texto chegam como string no
 * `req.body`. `mapeamento` vem serializado em JSON (o frontend faz
 * `JSON.stringify(mapeamento)` antes de anexar ao FormData) -- parseado manualmente no
 * controller (não via decorator `@Transform`/`@Type` encadeado, que tem ordem de
 * execução frágil combinando os dois no mesmo campo) e validado ali antes de repassar
 * pro caso de uso.
 */
export class PreVisualizarExtratoDto {
  @IsUUID()
  contaContabilId!: string;

  @MinLength(2)
  mapeamento!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  colunaTipoTransacao?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  valorCredito?: string | null;
}
