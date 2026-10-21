import { IsString, MaxLength, MinLength } from 'class-validator';

// Formato/checksum real (validarCnpj) é validado no domínio, não aqui -- aceita com ou
// sem máscara (14 dígitos puros ou "00.000.000/0000-00" com 18 caracteres).
export class CorrigirCnpjEmpresaDto {
  @IsString()
  @MinLength(14)
  @MaxLength(18)
  cnpj!: string;
}
