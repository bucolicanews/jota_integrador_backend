import { IsString, MaxLength, MinLength } from 'class-validator';

// Formato/checksum real (validarCpfOuCnpj) é validado no domínio, não aqui -- aceita
// CPF ou CNPJ, com ou sem máscara.
export class CorrigirCnpjCpfContadorDto {
  @IsString()
  @MinLength(11)
  @MaxLength(18)
  cnpjCpf!: string;
}
