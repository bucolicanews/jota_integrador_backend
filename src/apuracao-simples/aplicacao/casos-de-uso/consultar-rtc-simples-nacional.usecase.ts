import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Empresa, EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  ItemNotaFiscalPersistido,
  NOTAS_FISCAIS_REPOSITORIO,
  NotaFiscalResumo,
  NotasFiscaisRepositorioPort,
} from '../../../notas-fiscais/aplicacao/portas/notas-fiscais-repositorio.port';
import { ultimoDiaDoMes } from '../../dominio/receita-mensal';
import {
  CalculadoraRtcSimplesNacionalClient,
  ItemSimplesNacionalInput,
  ObservabilidadeSimplesNacionalOutput,
  OperacaoSimplesNacionalInput,
} from '../../infraestrutura/calculadora-rtc-simples-nacional.client';

export interface ResultadoNotaRtcSimplesNacional {
  notaFiscalId: string;
  chaveAcesso: string;
  resultado: ObservabilidadeSimplesNacionalOutput;
}

export interface ResultadoRtcSimplesNacional {
  competencia: string;
  /** Notas de saída aprovadas no período, com ao menos 1 item elegível (ver itensIgnorados). */
  notas: ResultadoNotaRtcSimplesNacional[];
  /**
   * Itens fora do cálculo por falta de `cClassTrib` no XML -- campo obrigatório pro
   * calculador (NT 2026.005), ainda não presente na maioria das notas reais em 2026 (fase
   * de transição da reforma). Não é erro, é limitação de dado de origem: contagem só pra
   * dar visibilidade no painel ("N itens sem classificação tributária RTC neste mês").
   */
  itensSemClassificacaoTributariaRtc: number;
}

/**
 * Chama a calculadora RTC Simples Nacional da RFB (container local, ver docker-compose.yml)
 * pra apurar CBS/IBS dos itens de nota fiscal de saída de uma competência. Puramente
 * consultivo nesta primeira versão -- não persiste resultado nem gera lançamento contábil
 * (isso é o próximo passo, condicionado a `empresa.apuracaoIbsCbsHibrida`, ver
 * project_jota_integrador memória "RTC/reforma tributária").
 */
@Injectable()
export class ConsultarRtcSimplesNacionalUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly notasFiscaisRepositorio: NotasFiscaisRepositorioPort,
    private readonly calculadora: CalculadoraRtcSimplesNacionalClient,
  ) {}

  async executar(empresaId: string, competencia: string): Promise<ResultadoRtcSimplesNacional> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    if (empresa.regimeTributario !== 'simples_nacional' && empresa.regimeTributario !== 'mei') {
      throw new BadRequestException('Cálculo RTC Simples Nacional só se aplica a empresas do Simples Nacional/MEI');
    }

    const fim = ultimoDiaDoMes(competencia);
    const notasSaidaAprovadas = (await this.notasFiscaisRepositorio.listarPorPeriodo(empresaId, competencia, fim)).filter(
      (n) => n.direcao === 'saida' && n.status === 'aprovada',
    );
    if (notasSaidaAprovadas.length === 0) {
      return { competencia, notas: [], itensSemClassificacaoTributariaRtc: 0 };
    }

    const itens = await this.notasFiscaisRepositorio.listarItensPorNotas(notasSaidaAprovadas.map((n) => n.id));
    const itensPorNota = new Map<string, ItemNotaFiscalPersistido[]>();
    for (const item of itens) {
      const lista = itensPorNota.get(item.notaFiscalId) ?? [];
      lista.push(item);
      itensPorNota.set(item.notaFiscalId, lista);
    }

    let itensSemClassificacaoTributariaRtc = 0;
    const notas: ResultadoNotaRtcSimplesNacional[] = [];

    for (const nota of notasSaidaAprovadas) {
      const itensDaNota = itensPorNota.get(nota.id) ?? [];
      const itensElegiveis: ItemSimplesNacionalInput[] = [];
      for (const item of itensDaNota) {
        const itemInput = this.montarItemOuNulo(item);
        if (itemInput) {
          itensElegiveis.push(itemInput);
        } else {
          itensSemClassificacaoTributariaRtc++;
        }
      }
      if (itensElegiveis.length === 0) continue;

      const operacao = this.montarOperacao(empresa, nota, itensElegiveis);
      const resultado = await this.calculadora.calcular(operacao);
      notas.push({ notaFiscalId: nota.id, chaveAcesso: nota.chaveAcesso, resultado });
    }

    return { competencia, notas, itensSemClassificacaoTributariaRtc };
  }

  /** CRT (Código de Regime Tributário do emitente, leiaute NFe) -- 1 Simples, 4 MEI. 2 (Simples com excesso de sublimite) e 3 (Regime Normal) não se aplicam aqui: filtrados em executar(). */
  private montarOperacao(empresa: Empresa, nota: NotaFiscalResumo, itens: ItemSimplesNacionalInput[]): OperacaoSimplesNacionalInput {
    return {
      id: nota.chaveAcesso,
      versao: '2.0.0',
      data: nota.dataEmissao.slice(0, 10),
      tpDoc: nota.modelo,
      CRT: empresa.regimeTributario === 'mei' ? '4' : '1',
      // "Apuração por fora" (RFB) == "apuracaoIbsCbsHibrida" (apura CBS/IBS fora do DAS,
      // débito-crédito) -- mesma expressão nas duas fontes, não confirmado 1:1 contra a NT
      // oficial ainda. CONFERIR COM CONTADOR antes de usar o resultado em declaração real.
      tpRegimeIBSCBS: empresa.apuracaoIbsCbsHibrida ? '2' : null,
      tpEnteGov: null,
      itens,
    };
  }

  /**
   * `cClassTrib` é obrigatório pro calculador e só existe no grupo IBSCBS do XML (NT
   * 2026.005, ver parser-xml-nfe.ts) -- ausente na maioria das notas reais em 2026 (fase de
   * transição). Item sem ele não entra no cálculo (retorna null), nunca inventa uma
   * classificação a partir de CST/CSOSN.
   */
  private montarItemOuNulo(item: ItemNotaFiscalPersistido): ItemSimplesNacionalInput | null {
    if (!item.cClassTrib) return null;

    return {
      numero: item.numeroItem,
      cAtivSN: item.cAtivSN,
      cClassTrib: item.cClassTrib,
      NBS: null,
      NCM: item.ncm,
      baseCalculo: item.valorTotal.toFixed(2),
      valorImpostoSeletivo: '0.00',
      pIBSSN: item.pIBSSN,
      pCBSSN: item.pCBSSN,
    };
  }
}
