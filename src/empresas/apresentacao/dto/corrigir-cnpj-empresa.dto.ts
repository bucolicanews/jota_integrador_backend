import { IsString, MaxLength, MinLength } from 'class-validator';

// Formato/checksum real (validarDocumentoEmpresa, CNPJ ou CPF conforme tipoPessoa da
// empresa) é validado no domínio, não aqui -- só limita tamanho pra aceitar os dois:
// CPF (11 dígitos puros) até CNPJ com máscara ("00.000.000/0000-00", 18 caracteres).
export class CorrigirCnpjEmpresaDto {
  @IsString()
  @MinLength(11)
  @MaxLength(18)
  cnpj!: string;
}
