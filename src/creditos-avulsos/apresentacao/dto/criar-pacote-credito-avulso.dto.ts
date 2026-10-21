import { IsInt, IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CriarPacoteCreditoAvulsoDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsInt()
  @Min(1)
  quantidadeCreditos!: number;

  @IsNumber()
  @Min(0.01)
  precoReais!: number;
}
