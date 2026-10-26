import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { custoDaOperacao } from '../../../creditos/dominio/credito';
import { CREDITOS_REPOSITORIO, CreditosRepositorioPort } from '../../../creditos/aplicacao/portas/creditos-repositorio.port';
import {
  ASSINATURAS_REPOSITORIO,
  AssinaturasRepositorioPort,
} from '../../../assinaturas/aplicacao/portas/assinaturas-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO,
  PlanoConsultasIncluidasRepositorioPort,
} from '../../../planos/aplicacao/portas/plano-consultas-incluidas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../../../serpro/aplicacao/portas/consultas-serpro-repositorio.port';
import { competenciasNoIntervalo, janelaPadraoCompetencias } from '../../dominio/das';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';
import { FiltroCompetenciaSincronizacao, MESES_JANELA_SINCRONIZACAO } from './sincronizar-das-empresa.usecase';
import { inicioDoPeriodo } from './verificar-cota-incluida.usecase';

const ID_SISTEMA_PGMEI = 'PGMEI';
const ID_SISTEMA_PGDASD = 'PGDASD';
const ID_SISTEMA_PAGTOWEB = 'PAGTOWEB';

const CUSTO_MEI = 'DAS';
const CUSTO_SIMPLES_NACIONAL = 'PGDAS';
const CUSTO_PAGAMENTO = 'CONSULTA_PAGAMENTO_DAS';

interface ItemEstimativa {
  idSistema: string;
  chamadasNecessarias: number;
  chamadasDentroDaCota: number;
  chamadasCobradas: number;
  custoPorChamada: number;
  subtotal: number;
  /** true = número pode ser menor na prática (Simples Nacional: só sabemos quantas declarações existem de fato depois de consultar o SERPRO). */
  aproximado: boolean;
}

export interface ResultadoEstimativa {
  creditosNecessarios: number;
  detalhamento: ItemEstimativa[];
  saldoAtual: number;
  saldoSuficiente: boolean;
}

/**
 * Só leitura -- nunca chama debitarCreditos/gateway.consultar. Reaproveita a mesma
 * lógica de "o que falta" de SincronizarDasEmpresaUseCase, mas sem executar nenhuma
 * chamada SERPRO nem gravar nada, pra não gastar crédito só pra mostrar a estimativa.
 */
@Injectable()
export class EstimarSincronizacaoDasUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
    @Inject(PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO)
    private readonly consultasIncluidasRepositorio: PlanoConsultasIncluidasRepositorioPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasSerproRepositorio: ConsultasSerproRepositorioPort,
  ) {}

  async executar(empresaId: string, filtro?: FiltroCompetenciaSincronizacao): Promise<ResultadoEstimativa> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }
    if (empresa.regimeTributario !== 'mei' && empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('Módulo de DAS só se aplica a empresas MEI ou Simples Nacional ME/EPP');
    }

    const assinatura = await this.assinaturasRepositorio.buscarAtivaPorEmpresa(empresaId);
    if (!assinatura) {
      throw new ForbiddenException('Empresa sem plano de créditos ativo -- contate seu contador');
    }

    const competencias =
      filtro?.competenciaInicio && filtro?.competenciaFim
        ? competenciasNoIntervalo(filtro.competenciaInicio, filtro.competenciaFim)
        : janelaPadraoCompetencias(MESES_JANELA_SINCRONIZACAO);

    const detalhamento: ItemEstimativa[] = [];

    if (empresa.regimeTributario === 'mei') {
      const existentes = new Set((await this.dasRepositorio.listarPorEmpresa(empresaId, 'mei')).map((item) => item.competencia));
      const faltantes = competencias.filter((c) => !existentes.has(c));
      if (faltantes.length > 0) {
        detalhamento.push(await this.montarItem(empresaId, assinatura.planoId, ID_SISTEMA_PGMEI, CUSTO_MEI, faltantes.length, false));
      }

      const pendentes = await this.dasRepositorio.listarPendentesComNumeroDocumento(empresaId, 'mei');
      if (pendentes.length > 0) {
        detalhamento.push(await this.montarItem(empresaId, assinatura.planoId, ID_SISTEMA_PAGTOWEB, CUSTO_PAGAMENTO, 1, false));
      }
    } else {
      // CONSDECLARACAO13 é por ano inteiro, não por competência -- sempre 1 chamada, não dá pra reduzir escolhendo intervalo.
      detalhamento.push(await this.montarItem(empresaId, assinatura.planoId, ID_SISTEMA_PGDASD, CUSTO_SIMPLES_NACIONAL, 1, false));

      // Upper bound: assume que toda competência faltante no intervalo tem declaração transmitida (só
      // confirmado de verdade depois da chamada acima) -- por isso aproximado=true aqui.
      const existentes = new Set(
        (await this.dasRepositorio.listarPorEmpresa(empresaId, 'simples_nacional')).map((item) => item.competencia),
      );
      const faltantes = competencias.filter((c) => !existentes.has(c));
      if (faltantes.length > 0) {
        detalhamento.push(
          await this.montarItem(empresaId, assinatura.planoId, ID_SISTEMA_PGDASD, CUSTO_SIMPLES_NACIONAL, faltantes.length, true),
        );
      }
    }

    const creditosNecessarios = detalhamento.reduce((acc, item) => acc + item.subtotal, 0);
    const saldoAtual = await this.creditosRepositorio.obterSaldo(empresaId);

    return {
      creditosNecessarios,
      detalhamento,
      saldoAtual,
      saldoSuficiente: saldoAtual >= creditosNecessarios,
    };
  }

  /** Mesma conta de cota de VerificarCotaIncluidaUseCase, só que contando N chamadas hipotéticas em vez de 1 real. */
  private async montarItem(
    empresaId: string,
    planoId: string | null,
    idSistema: string,
    custoOperacao: string,
    chamadasNecessarias: number,
    aproximado: boolean,
  ): Promise<ItemEstimativa> {
    const cota = planoId ? await this.consultasIncluidasRepositorio.buscar(planoId, idSistema) : null;
    let cotaRestante = 0;
    if (cota) {
      const usoNoPeriodo = await this.consultasSerproRepositorio.contarSucessoNoPeriodo(empresaId, idSistema, inicioDoPeriodo(cota.periodo));
      cotaRestante = Math.max(0, cota.quantidadePorPeriodo - usoNoPeriodo);
    }

    const chamadasDentroDaCota = Math.min(chamadasNecessarias, cotaRestante);
    const chamadasCobradas = chamadasNecessarias - chamadasDentroDaCota;
    const custoPorChamada = custoDaOperacao(custoOperacao);

    return {
      idSistema,
      chamadasNecessarias,
      chamadasDentroDaCota,
      chamadasCobradas,
      custoPorChamada,
      subtotal: chamadasCobradas * custoPorChamada,
      aproximado,
    };
  }
}
