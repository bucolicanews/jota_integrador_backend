import { IsArray, IsUUID } from 'class-validator';

export class AtualizarTetoPermissoesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  permissaoIds!: string[];
}
