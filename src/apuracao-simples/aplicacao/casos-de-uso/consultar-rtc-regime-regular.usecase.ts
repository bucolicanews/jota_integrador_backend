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
  CalculadoraRtcRegimeRegularClient,
  ItemOperacaoRegularInput,
  OperacaoRegularInput,
  RocDomainOutput,
} from '../../infraestrutura/calculadora-rtc-regime-regular.client';

export interface ResultadoNotaRtcRegimeRegular {
  notaFiscalId: string;
  chaveAcesso: string;
  resultado: RocDomainOutput;
}

export interface ResultadoRtcRegimeRegular {
  competencia: string;
  /** Notas de saída aprovadas no período, com ao menos 1 item elegível (ver itensIgnorados). */
  notas: ResultadoNotaRtcRegimeRegular[];
  /**
   * Itens fora do cálculo por falta de `cClassTrib`/CST-IBS/CBS no XML (Grupo UB, NT
   * 2026.005) -- ausentes na maioria das notas reais em 2026 (fase de transição). Não é
   * erro, é limitação de dado de origem.
   */
  itensSemClassificacaoTributariaRtc: number;
}

/**
 * Chama a calculadora RTC Regime Regular da RFB (container local, ver docker-compose.yml)
 * pra apurar CBS/IBS/Imposto Seletivo dos itens de nota fiscal de saída de uma competência.
 * Serve 2 públicos: empresas em lucro_presumido/lucro_real/lucro_arbitrado, e empresas do
 * Simples com `apuracaoIbsCbsHibrida=true` (mesmo cálculo débito-crédito, não-cumulativo --
 * ver ConsultarApuracaoRtcUseCase pra decisão de qual calculador usar). Puramente consultivo
 * nesta primeira versão -- não persiste resultado nem gera lançamento contábil.
 */
@Injectable()
export class ConsultarRtcRegimeRegularUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly notasFiscaisRepositorio: NotasFiscaisRepositorioPort,
    private readonly calculadora: CalculadoraRtcRegimeRegularClient,
  ) {}

  async executar(empresaId: string, competencia: string): Promise<ResultadoRtcRegimeRegular> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    this.exigirElegibilidade(empresa);

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
    const notas: ResultadoNotaRtcRegimeRegular[] = [];

    for (const nota of notasSaidaAprovadas) {
      if (nota.municipioFatoGeradorIBGE === null || nota.ufEmitente === null) {
        throw new BadRequestException(
          `Nota ${nota.chaveAcesso} sem município/UF do fato gerador (ide/cMunFG, emit/enderEmit/UF) -- XML antigo ou incompleto, não entra no cálculo RTC`,
        );
      }

      const itensDaNota = itensPorNota.get(nota.id) ?? [];
      const itensElegiveis: ItemOperacaoRegularInput[] = [];
      for (const item of itensDaNota) {
        const itemInput = this.montarItemOuNulo(item);
        if (itemInput) {
          itensElegiveis.push(itemInput);
        } else {
          itensSemClassificacaoTributariaRtc++;
        }
      }
      if (itensElegiveis.length === 0) continue;

      const operacao = this.montarOperacao(nota, itensElegiveis);
      const resultado = await this.calculadora.calcular(operacao);
      notas.push({ notaFiscalId: nota.id, chaveAcesso: nota.chaveAcesso, resultado });
    }

    return { competencia, notas, itensSemClassificacaoTributariaRtc };
  }

  /** Mesma elegibilidade usada por ConsultarApuracaoRtcUseCase pra decidir qual calculador chamar -- mantida aqui pra permitir chamar este usecase direto, não só via dispatcher. */
  private exigirElegibilidade(empresa: Empresa): void {
    const regimeRegular = empresa.regimeTributario === 'lucro_presumido' || empresa.regimeTributario === 'lucro_real' || empresa.regimeTributario === 'lucro_arbitrado';
    const simplesHibrido = (empresa.regimeTributario === 'simples_nacional' || empresa.regimeTributario === 'mei') && empresa.apuracaoIbsCbsHibrida;
    if (!regimeRegular && !simplesHibrido) {
      throw new BadRequestException(
        'Cálculo RTC Regime Regular só se aplica a lucro_presumido/lucro_real/lucro_arbitrado, ou Simples Nacional com apuração híbrida',
      );
    }
  }

  private montarOperacao(nota: NotaFiscalResumo, itens: ItemOperacaoRegularInput[]): OperacaoRegularInput {
    return {
      id: nota.chaveAcesso,
      versao: '0.0.1',
      dhFatoGerador: nota.dataEmissao,
      municipio: nota.municipioFatoGeradorIBGE as number,
      uf: nota.ufEmitente as string,
      tpDoc: Number(nota.modelo),
      itens,
    };
  }

  /**
   * `cst` (CST-IBS/CBS, 3 dígitos) e `cClassTrib` (6 dígitos) são obrigatórios e só existem
   * no grupo IBSCBS do XML (Grupo UB, NT 2026.005/2025.002, ver parser-xml-nfe.ts) --
   * ausentes na maioria das notas reais em 2026 (fase de transição). Item sem qualquer um
   * dos dois não entra no cálculo, nunca inventa classificação a partir de CST/CSOSN antigo.
   */
  private montarItemOuNulo(item: ItemNotaFiscalPersistido): ItemOperacaoRegularInput | null {
    if (!item.cClassTrib || !item.cstIbsCbs) return null;

    return {
      numero: item.numeroItem,
      ncm: item.ncm,
      nbs: null,
      cst: item.cstIbsCbs,
      cClassTrib: item.cClassTrib,
      baseCalculo: item.valorTotal.toFixed(2),
      quantidade: item.quantidade.toString(),
      unidade: null,
    };
  }
}
