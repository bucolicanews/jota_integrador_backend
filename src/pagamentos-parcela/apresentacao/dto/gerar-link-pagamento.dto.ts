import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GerarLinkPagamentoDto {
  @IsIn(['pix', 'cartao'])
  metodo!: 'pix' | 'cartao';

  /** Obrigatório quando metodo='cartao' -- PagSeguro.encryptCard() no navegador, nunca número/CVV em texto puro. */
  @IsOptional()
  @IsString()
  cardEncrypted?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;
}
