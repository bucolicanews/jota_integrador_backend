import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ConfirmarTransacoesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  transacaoIds!: string[];
}
