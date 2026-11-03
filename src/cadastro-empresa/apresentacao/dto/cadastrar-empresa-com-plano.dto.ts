import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { ModoAcessoSerpro, REGIMES_TRIBUTARIOS, RegimeTributario } from '../../../empresas/dominio/empresa';
import { ModeloPlanoContas } from '../../../plano-de-contas/dominio/modelos-plano-contas';
import { CobrancaCadastroEmpresa } from '../../aplicacao/casos-de-uso/cadastrar-empresa-com-plano.usecase';

const MODELOS_PLANO_CONTAS: ModeloPlanoContas[] = ['comercio', 'servico', 'terceiro_setor'];

export class CadastrarEmpresaComPlanoDto {
  // Só usado/aceito quando quem chama é SUPER_ADMIN -- pra qualquer outro papel o
  // controller ignora e usa o contadorId do próprio usuário autenticado (mesma regra de
  // antes, nunca confia no client pra definir de quem é a empresa).
  @IsOptional()
  @IsUUID()
  contadorId?: string;

  @MinLength(2)
  @MaxLength(200)
  razaoSocial!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomeFantasia?: string | null;

  @IsString()
  @MinLength(14)
  @MaxLength(18)
  cnpj!: string;

  @IsOptional()
  @IsIn(REGIMES_TRIBUTARIOS)
  regimeTributario?: RegimeTributario | null;

  @IsIn(['procuracao', 'certificado_proprio'])
  modoAcessoSerpro!: ModoAcessoSerpro;

  @IsOptional()
  @IsIn(MODELOS_PLANO_CONTAS)
  planoContasModelo?: ModeloPlanoContas | null;

  @IsUUID()
  planoId!: string;

  @IsIn(['gratis', 'contador_paga_agora', 'cliente_paga_depois'])
  cobranca!: CobrancaCadastroEmpresa;

  @IsOptional()
  @IsIn(['pix', 'cartao'])
  metodo?: 'pix' | 'cartao';

  /** Obrigatório quando metodo='cartao' -- PagSeguro.encryptCard() no navegador, nunca número/CVV em texto puro. */
  @IsOptional()
  @IsString()
  cardEncrypted?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;

  @MinLength(2)
  @MaxLength(200)
  clienteNome!: string;

  @IsEmail()
  clienteEmail!: string;
}
