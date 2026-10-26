import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { DebitarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/debitar-creditos.usecase';
import { EstornarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/estornar-creditos.usecase';
import { custoDaOperacao } from '../../../creditos/dominio/credito';
import { SaldoInsuficienteError } from '../../../creditos/aplicacao/portas/creditos-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../../../serpro/aplicacao/portas/consultas-serpro-repositorio.port';
import { SERPRO_GATEWAY, SerproGatewayPort } from '../../../serpro/aplicacao/portas/serpro-gateway.port';
import { StatusProcuracao, validarTransicaoStatusProcuracao } from '../../dominio/procuracao';
import { PROCURACOES_REPOSITORIO, Procuracao, ProcuracoesRepositorioPort } from '../portas/procuracoes-repositorio.port';

const ID_SISTEMA = 'PROCURACOES';
const ID_SERVICO = 'OBTERPROCURACAO41';
const CUSTO_OPERACAO = 'PROCURACOES';

/** Um item do array de `dados` da resposta (confirmado contra produção em 2026-10-26 -- ver [[reference_serpro_catalogo_idsistema_idservico]]). */
interface ProcuracaoSerpro {
  dtexpiracao: string; // AAAAMMDD
  nrsistemas: number;
  sistemas: string[];
}

/**
 * Sync automático de procuração via SERPRO (`idSistema=PROCURACOES`, `idServico=OBTERPROCURACAO41`)
 * -- payload/resposta CONFIRMADOS contra produção real em 2026-10-26 (empresa de teste,
 * CNPJ 49100380000125), substitui a pendência documentada em
 * AtualizarStatusProcuracaoUseCase ("sync automático... contrato ainda não confirmado").
 *
 * De propósito SEM exigir assinatura ativa/módulo fiscal (mesmo raciocínio de
 * TestarConexaoSerproUseCase): é o mecanismo que ALIMENTA o gate de acesso, não uma
 * funcionalidade fiscal paga por si -- precisa funcionar mesmo numa empresa sem plano
 * ainda. Nunca transiciona pra "revogada" automaticamente (estado terminal, só
 * confirmação manual explícita cria essa certeza -- SERPRO não distingue "nunca
 * outorgada" de "revogada" nesta resposta, só diz se uma procuração válida existe agora).
 */
@Injectable()
export class SincronizarProcuracaoUseCase {
  private readonly logger = new Logger(SincronizarProcuracaoUseCase.name);

  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PROCURACOES_REPOSITORIO) private readonly procuracoesRepositorio: ProcuracoesRepositorioPort,
    @Inject(SERPRO_GATEWAY) private readonly gateway: SerproGatewayPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasRepositorio: ConsultasSerproRepositorioPort,
    private readonly debitarCreditos: DebitarCreditosUseCase,
    private readonly estornarCreditos: EstornarCreditosUseCase,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  async executar(empresaId: string): Promise<Procuracao> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }
    if (empresa.modoAcessoSerpro !== 'procuracao') {
      throw new BadRequestException('Empresa não está no modo de acesso por procuração eletrônica');
    }

    const atual = await this.procuracoesRepositorio.garantirLinha(empresaId);
    if (atual.status === 'revogada') {
      // Terminal -- nunca reconsultamos sozinhos (comentário do domínio: "nova procuração é uma linha nova").
      return atual;
    }

    try {
      await this.debitarCreditos.executar(empresa.contadorId, empresaId, CUSTO_OPERACAO, `Sincronizar procuração -- empresa ${empresaId}`);
    } catch (erro) {
      if (erro instanceof SaldoInsuficienteError) {
        throw new ForbiddenException('Saldo de créditos insuficiente pra sincronizar a procuração');
      }
      throw erro;
    }

    const outorgado = this.config.get<string>('SERPRO_CONTRATANTE_CNPJ') ?? '';

    let sucesso = false;
    let codigoErro: string | null = null;
    let procuracoesSerpro: ProcuracaoSerpro[] = [];

    try {
      const resposta = await this.gateway.consultar({
        idSistema: ID_SISTEMA,
        idServico: ID_SERVICO,
        contribuinteCnpj: empresa.cnpj,
        dados: JSON.stringify({
          outorgante: empresa.cnpj,
          tipoOutorgante: '2',
          outorgado,
          tipoOutorgado: '2',
        }),
      });
      sucesso = resposta.sucesso;
      if (sucesso) {
        procuracoesSerpro = this.extrairProcuracoes(resposta.corpo);
      } else {
        codigoErro = `HTTP_${resposta.statusHttp}`;
      }
    } catch {
      codigoErro = 'ERRO_COMUNICACAO';
    }

    if (!sucesso) {
      await this.estornarCreditos.executar(
        empresa.contadorId,
        empresaId,
        custoDaOperacao(CUSTO_OPERACAO),
        `Sincronizar procuração falhou (${codigoErro})`,
      );
    }

    await this.consultasRepositorio.registrar({
      contadorId: empresa.contadorId,
      empresaId,
      idSistema: ID_SISTEMA,
      idServico: ID_SERVICO,
      sucesso,
      codigoErro,
      creditosConsumidos: sucesso ? custoDaOperacao(CUSTO_OPERACAO) : 0,
    });

    if (!sucesso) {
      this.logger.warn(`Falha ao sincronizar procuração da empresa ${empresaId}: ${codigoErro}`);
      return atual;
    }

    return this.aplicarResultado(empresaId, atual, procuracoesSerpro);
  }

  private async aplicarResultado(empresaId: string, atual: Procuracao, procuracoes: ProcuracaoSerpro[]): Promise<Procuracao> {
    const hoje = new Date().toISOString().slice(0, 10);
    // Entre os grupos retornados, prioriza o que cobre "TODOS" (procuração geral, caso
    // confirmado no teste real) -- senão pega o de validade mais longa, melhor sinal
    // disponível de "até quando a Jota está autorizada".
    const melhor = procuracoes.find((p) => p.sistemas.includes('TODOS')) ?? this.maiorValidade(procuracoes);
    const expiraEm = melhor ? this.aaaammddParaIso(melhor.dtexpiracao) : null;
    const ativaAgora = expiraEm !== null && expiraEm >= hoje;

    const novoStatus: StatusProcuracao = ativaAgora ? 'ativa' : atual.status === 'pendente' ? 'pendente' : 'expirada';

    try {
      validarTransicaoStatusProcuracao(atual.status, novoStatus);
    } catch {
      // Transição que o domínio não permite automaticamente (ex: só manual) -- não força, mantém como está.
      return atual;
    }

    if (novoStatus === atual.status && expiraEm === atual.expiraEm) {
      return atual; // nada mudou, evita update/auditoria ruidosa a cada execução do cron
    }

    const atualizada = await this.procuracoesRepositorio.atualizarStatus(atual.id, {
      status: novoStatus,
      outorgadaEm: atual.outorgadaEm, // SERPRO não devolve data de outorga, preserva o que já tínhamos
      expiraEm,
    });

    await this.auditoria.registrar({
      usuarioId: null,
      empresaId,
      acao: 'procuracao.sincronizar_automatico',
      recurso: 'procuracoes',
      dadosAntigos: { status: atual.status, expiraEm: atual.expiraEm },
      dadosNovos: { status: atualizada.status, expiraEm: atualizada.expiraEm },
    });

    return atualizada;
  }

  private maiorValidade(procuracoes: ProcuracaoSerpro[]): ProcuracaoSerpro | undefined {
    return procuracoes.reduce<ProcuracaoSerpro | undefined>(
      (maior, atual) => (!maior || atual.dtexpiracao > maior.dtexpiracao ? atual : maior),
      undefined,
    );
  }

  private aaaammddParaIso(aaaammdd: string): string {
    return `${aaaammdd.slice(0, 4)}-${aaaammdd.slice(4, 6)}-${aaaammdd.slice(6, 8)}`;
  }

  /** `corpo.dados` é string com JSON aninhado (mesmo padrão de CONSDECLARACAO13 etc) -- confirmado contra produção. */
  private extrairProcuracoes(corpo: unknown): ProcuracaoSerpro[] {
    try {
      const corpoObj = corpo as { dados?: string };
      if (!corpoObj?.dados) return [];
      return JSON.parse(corpoObj.dados) as ProcuracaoSerpro[];
    } catch {
      return [];
    }
  }
}
