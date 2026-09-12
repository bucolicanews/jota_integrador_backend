import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarClienteDto {
  @MinLength(1)
  @MaxLength(200)
  nome!: string;

  @IsOptional() @IsString() @MaxLength(200) razaoSocial?: string;
  @IsOptional() @IsString() @MaxLength(20) documento?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(20) telefone?: string;
  @IsOptional() @IsString() @MaxLength(10) cep?: string;
  @IsOptional() @IsString() @MaxLength(200) endereco?: string;
  @IsOptional() @IsString() @MaxLength(20) numero?: string;
  @IsOptional() @IsString() @MaxLength(100) complemento?: string;
  @IsOptional() @IsString() @MaxLength(100) bairro?: string;
  @IsOptional() @IsString() @MaxLength(100) cidade?: string;
  @IsOptional() @IsString() @MaxLength(2) estado?: string;
}
