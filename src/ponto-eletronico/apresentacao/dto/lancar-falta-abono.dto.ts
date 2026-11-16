import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

// multipart/form-data -- campos numéricos chegam como string, @Type() força a conversão
// antes da validação (o global ValidationPipe não faz conversão implícita).
export class LancarFaltaAbonoDto {
  @IsUUID()
  usuarioAlvoId!: string;

  @IsDateString()
  data!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  horasFalta!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  horasAbono!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;

  /** Edição de um lançamento existente: preserva o atestado já anexado sem reenviar o
   * arquivo (não há endpoint de "copiar anexo" -- carrega só a referência de storage já
   * validada, nunca aceita um path arbitrário vindo de outro usuário: usecase sempre
   * resolve via o registro antigo, nunca confia nesse valor isolado pra outra coisa). */
  @IsOptional()
  @IsString()
  atestadoStorageRefExistente?: string;
}
