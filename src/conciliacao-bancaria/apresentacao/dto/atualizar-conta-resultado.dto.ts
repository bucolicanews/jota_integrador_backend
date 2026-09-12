import { IsUUID } from 'class-validator';

export class AtualizarContaResultadoDto {
  @IsUUID()
  contaContabilResultadoId!: string;
}
