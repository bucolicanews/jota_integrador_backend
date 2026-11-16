import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { REGIMES_TRIBUTARIOS, RegimeTributario, TipoPessoaEmpresa } from '../../dominio/empresa';

export class AtualizarEmpresaDto {
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomeFantasia?: string | null;

  @IsOptional()
  @IsIn(REGIMES_TRIBUTARIOS)
  regimeTributario?: RegimeTributario | null;

  // Só aceito de verdade quando a empresa já é tipo='interna_contador' -- usecase rejeita
  // senão (empresa-cliente é sempre jurídica, ver validarDocumentoEmpresa).
  @IsOptional()
  @IsIn(['fisica', 'juridica'])
  tipoPessoa?: TipoPessoaEmpresa;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  crc?: string | null;

  // "Simples Híbrido" -- só tem efeito quando regimeTributario='simples_nacional'
  // (validado no usecase, não aqui -- o DTO não sabe o regime atual da empresa).
  @IsOptional()
  @IsBoolean()
  apuracaoIbsCbsHibrida?: boolean;
}
