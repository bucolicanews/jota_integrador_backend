import { IsUUID } from 'class-validator';

export class AdicionarMembroEquipeDto {
  @IsUUID()
  usuarioId!: string;
}
