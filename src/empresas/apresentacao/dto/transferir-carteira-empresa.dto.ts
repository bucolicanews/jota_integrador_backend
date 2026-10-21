import { IsString, Matches } from 'class-validator';

// `@IsUUID()` do class-validator rejeita o id sentinela 'Jota Contabilidade'
// (00000000-0000-0000-0000-000000000001 -- dígito de versão '0', fora de 1-5) --
// confirmado testando de verdade. Formato solto aqui (8-4-4-4-12 hex), a existência de
// verdade é garantida pela FK empresas.contador_id -> contadores.id (23503 tratado no
// repositório), não precisa duplicar a regra aqui.
export class TransferirCarteiraEmpresaDto {
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { message: 'contadorId deve ser um identificador válido' })
  contadorId!: string;
}
