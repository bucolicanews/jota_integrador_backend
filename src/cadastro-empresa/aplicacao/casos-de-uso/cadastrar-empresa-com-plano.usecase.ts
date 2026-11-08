import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AtivarAssinaturaManualUseCase } from '../../../assinaturas/aplicacao/casos-de-uso/ativar-assinatura-manual.usecase';
import { IniciarPagamentoAssinaturaCreditosUseCase } from '../../../assinaturas/aplicacao/casos-de-uso/iniciar-pagamento-assinatura-creditos.usecase';
import { Assinatura } from '../../../assinaturas/aplicacao/portas/assinaturas-repositorio.port';
import { CriarUsuarioUseCase, ResultadoCriarUsuario } from '../../../auth/aplicacao/casos-de-uso/criar-usuario.usecase';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../../../auth/aplicacao/portas/usuarios-repositorio.port';
import { Papel } from '../../../auth/dominio/papel';
import { CriarEmpresaUseCase } from '../../../empresas/aplicacao/casos-de-uso/criar-empresa.usecase';
import { Empresa } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { ModoAcessoSerpro, RegimeTributario } from '../../../empresas/dominio/empresa';
import { ModeloPlanoContas } from '../../../plano-de-contas/dominio/modelos-plano-contas';
import { SemearPlanoContasUseCase } from '../../../plano-de-contas/aplicacao/casos-de-uso/semear-plano-contas.usecase';

export type CobrancaCadastroEmpresa = 'gratis' | 'contador_paga_agora' | 'cliente_paga_depois';

export interface EntradaCadastrarEmpresaComPlano {
  contadorId: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: RegimeTributario | null;
  modoAcessoSerpro: ModoAcessoSerpro;
  /** Opcional -- quando informado, semeia o plano de contas da empresa com esse modelo padrão. */
  planoContasModelo?: ModeloPlanoContas | null;
  planoId: string;
  cobranca: CobrancaCadastroEmpresa;
  /** Obrigatório quando cobranca !== 'gratis'. */
  metodo?: 'pix' | 'cartao';
  /** Obrigatório quando metodo='cartao' -- PagSeguro.encryptCard() no navegador, nunca número/CVV em texto puro. */
  cardEncrypted?: string;
  installments?: number;
  clienteNome: string;
  clienteEmail: string;
}

export interface ResultadoCadastrarEmpresaComPlano {
  empresa: Empresa;
  /** Só preenchido no caminho 'gratis' -- nos pagos a assinatura só fica ativa quando o webhook confirmar. */
  assinatura: Assinatura | null;
  /** Só preenchido nos caminhos pagos. */
  pagamento: { pagamentoId: string; pixCode: string | null; pixQrUrl: string | null } | null;
  usuario: ResultadoCriarUsuario;
}

/**
 * Cadastro de empresa não termina mais em "empresa sem plano, travada pelo
 * AssinaturaAtivaInterceptor até alguém lembrar de ativar manualmente" -- orquestra os 3
 * passos que antes eram manuais e desconectados (criar empresa / ativar-ou-cobrar plano /
 * convidar o usuário dela), cada um reaproveitando o usecase que já existia, sem duplicar
 * regra nenhuma. Plano é SEMPRE obrigatório aqui; "grátis" é uma cobrança como qualquer
 * outra (AtivarAssinaturaManualUseCase), não uma omissão.
 *
 * Ordem importa: usuário é criado logo depois da empresa, ANTES da cobrança -- se o cartão
 * for recusado (IniciarPagamentoAssinaturaCreditosUseCase pode lançar), o login do cliente
 * já existe mesmo assim; ele só não vai conseguir usar nada até o plano ficar ativo (mesmo
 * gate de sempre, AssinaturaAtivaInterceptor). Falha em qualquer passo depois do primeiro
 * deixa a empresa já criada "pela metade", recuperável nas telas manuais que já existiam
 * antes desta orquestração (ativar plano / criar usuário) -- mesmo padrão de
 * CriarContadorUseCase, que já aceita esse mesmo risco entre seus próprios passos.
 */
@Injectable()
export class CadastrarEmpresaComPlanoUseCase {
  constructor(
    private readonly criarEmpresa: CriarEmpresaUseCase,
    private readonly ativarManual: AtivarAssinaturaManualUseCase,
    private readonly iniciarPagamento: IniciarPagamentoAssinaturaCreditosUseCase,
    private readonly criarUsuario: CriarUsuarioUseCase,
    private readonly semearPlanoContas: SemearPlanoContasUseCase,
    @Inject(USUARIOS_REPOSITORIO) private readonly usuariosRepositorio: UsuariosRepositorioPort,
  ) {}

  async executar(dados: EntradaCadastrarEmpresaComPlano): Promise<ResultadoCadastrarEmpresaComPlano> {
    if (dados.cobranca !== 'gratis' && !dados.metodo) {
      throw new BadRequestException('Informe o método de pagamento (pix ou cartão)');
    }

    const empresa = await this.criarEmpresa.executar({
      contadorId: dados.contadorId,
      razaoSocial: dados.razaoSocial,
      nomeFantasia: dados.nomeFantasia,
      cnpj: dados.cnpj,
      regimeTributario: dados.regimeTributario,
      modoAcessoSerpro: dados.modoAcessoSerpro,
    });

    // Opcional -- quem não escolhe modelo segue como antes, plano de contas vazio pro
    // contador montar na mão (ver PlanoContasController).
    if (dados.planoContasModelo) {
      await this.semearPlanoContas.executar(empresa.id, dados.planoContasModelo);
    }

    const infoPapel = await this.usuariosRepositorio.buscarPapelPorNome(Papel.EMPRESARIO_DONO, { contadorId: null, empresaId: null });
    const usuario = await this.criarUsuario.executar({
      nome: dados.clienteNome,
      email: dados.clienteEmail,
      infoPapel,
      contadorId: null,
      empresaId: empresa.id,
    });

    let assinatura: Assinatura | null = null;
    let pagamento: { pagamentoId: string; pixCode: string | null; pixQrUrl: string | null } | null = null;

    if (dados.cobranca === 'gratis') {
      assinatura = await this.ativarManual.executar({
        contadorId: dados.contadorId,
        empresaId: empresa.id,
        planoId: dados.planoId,
        planoRevendaId: null,
      });
    } else {
      pagamento = await this.iniciarPagamento.executar({
        contadorId: dados.contadorId,
        empresaId: empresa.id,
        planoId: dados.planoId,
        metodo: dados.metodo!,
        cardEncrypted: dados.cardEncrypted,
        installments: dados.installments,
        customerEmail: dados.clienteEmail,
        customerTelefoneE164: null,
      });
    }

    return { empresa, assinatura, pagamento, usuario };
  }
}
