import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NOTAS_FISCAIS_REPOSITORIO, NotasFiscaisRepositorioPort } from '../../../notas-fiscais/aplicacao/portas/notas-fiscais-repositorio.port';
import { AnexoSimplesNacional, ChaveAtividadeServico, determinarAnexoComercioIndustria, determinarAnexoServico } from '../../dominio/catalogo-anexos-simples';
import { CategoriaTributacaoItem, categorizarItem } from '../../dominio/categorizar-tributacao-item';
import { ultimoDiaDoMes } from '../../dominio/receita-mensal';
import { calcularAliquotaEfetiva, ResultadoAliquotaEfetiva } from '../../dominio/tabelas-aliquotas-simples';
import { obterPartilha, percentualIcmsOuIss, percentualPisCofins } from '../../dominio/tabelas-partilha-simples';
import { RECEITAS_MENSAIS_REPOSITORIO, ReceitasMensaisRepositorioPort } from '../portas/receitas-mensais-repositorio.port';
import { CalcularFatorRUseCase } from './calcular-fator-r.usecase';
import { CalcularRbt12UseCase, ResultadoRbt12 } from './calcular-rbt12.usecase';

export interface BaldeApurado {
  tipo: CategoriaTributacaoItem;
  receita: number;
  /** Fração (0 a 1) excluída da alíquota efetiva pra este balde -- 0 pro balde "normal". */
  percentualExcluido: number;
  aliquotaAplicada: number;
  das: number;
}

export interface SegregacaoApurada extends ResultadoAliquotaEfetiva {
  receitaDoMes: number;
  dasDevido: number;
  /** Partilha de tributos (Fase 4.5) -- só preenchido com dado real pra comércio/indústria, que tem CST por item. Receita de serviço vem sempre manual (sem CST pra categorizar), fica 100% no balde "normal". */
  baldes: BaldeApurado[];
}

export interface ResultadoApuracaoSimples {
  competencia: string;
  rbt12: ResultadoRbt12;
  fatorR: number | null;
  comercioIndustria: SegregacaoApurada;
  servico: SegregacaoApurada | null;
  dasTotalCalculado: number;
}

type ReceitaPorCategoria = Record<CategoriaTributacaoItem, number>;

function receitaVazia(): ReceitaPorCategoria {
  return { normal: 0, icms_ja_recolhido: 0, pis_cofins_ja_recolhido: 0, ambos_ja_recolhidos: 0 };
}

/**
 * Junta RBT12 (Fase 1) + Fator R (Fase 2) + Anexo (Fase 3) + alíquota efetiva (Fase 4) +
 * partilha de tributos (Fase 4.5) numa única apuração pra uma competência -- é o número
 * que vai pro painel/resumo de envio (NUNCA transmitido automaticamente, ver Fase 6 do
 * plano). RBT12 continua bruto (substituição tributária/monofásico não tiram receita do
 * RBT12) -- só a alíquota aplicada no mês é segregada por balde. Mecanismo confirmado via
 * pesquisa (Resolução CGSN 140/2018); número exato do artigo não confirmado com certeza
 * total -- conferir com contador antes de citar em material oficial.
 */
@Injectable()
export class CalcularApuracaoSimplesUseCase {
  constructor(
    @Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly notasFiscaisRepositorio: NotasFiscaisRepositorioPort,
    @Inject(RECEITAS_MENSAIS_REPOSITORIO) private readonly receitasRepositorio: ReceitasMensaisRepositorioPort,
    private readonly calcularRbt12: CalcularRbt12UseCase,
    private readonly calcularFatorR: CalcularFatorRUseCase,
  ) {}

  async executar(empresaId: string, competencia: string, chaveAtividadeServico?: ChaveAtividadeServico): Promise<ResultadoApuracaoSimples> {
    const [rbt12, fatorRResultado, receitaDoMes] = await Promise.all([
      this.calcularRbt12.executar(empresaId, competencia),
      this.calcularFatorR.executar(empresaId, competencia),
      this.obterReceitaSegregadaDoMes(empresaId, competencia),
    ]);

    const anexoComercio = determinarAnexoComercioIndustria();
    const aliqComercio = calcularAliquotaEfetiva(anexoComercio, rbt12.totalComercioIndustria);
    const comercioIndustria = this.montarSegregacao(aliqComercio, receitaDoMes.comercioIndustria);

    const receitaServicoTotal = Object.values(receitaDoMes.servico).reduce((acc, v) => acc + v, 0);
    let servico: SegregacaoApurada | null = null;
    if (receitaServicoTotal > 0) {
      if (!chaveAtividadeServico) {
        throw new BadRequestException('Há receita de serviço no mês -- informe a atividade de serviço (chaveAtividadeServico) pra determinar o Anexo.');
      }
      const anexoServico = determinarAnexoServico(chaveAtividadeServico, fatorRResultado.fatorR);
      const aliqServico = calcularAliquotaEfetiva(anexoServico, rbt12.totalServico);
      servico = this.montarSegregacao(aliqServico, receitaDoMes.servico);
    }

    return {
      competencia,
      rbt12,
      fatorR: fatorRResultado.fatorR,
      comercioIndustria,
      servico,
      dasTotalCalculado: comercioIndustria.dasDevido + (servico?.dasDevido ?? 0),
    };
  }

  /** aliquotaBalde = aliquotaEfetiva × (1 − percentual do tributo já recolhido na faixa). RBT12/alíquota efetiva não mudam -- só a fração aplicada por balde. */
  private montarSegregacao(aliq: ResultadoAliquotaEfetiva, receitaPorCategoria: ReceitaPorCategoria): SegregacaoApurada {
    const faixaPartilha = obterPartilha(aliq.anexo, aliq.rbt12);
    const pctIcmsOuIss = percentualIcmsOuIss(faixaPartilha);
    const pctPisCofins = percentualPisCofins(faixaPartilha);

    const PERCENTUAL_EXCLUIDO: Record<CategoriaTributacaoItem, number> = {
      normal: 0,
      icms_ja_recolhido: pctIcmsOuIss,
      pis_cofins_ja_recolhido: pctPisCofins,
      ambos_ja_recolhidos: pctIcmsOuIss + pctPisCofins,
    };

    const baldes: BaldeApurado[] = (Object.keys(receitaPorCategoria) as CategoriaTributacaoItem[]).map((tipo) => {
      const receita = receitaPorCategoria[tipo];
      const percentualExcluido = PERCENTUAL_EXCLUIDO[tipo];
      const aliquotaAplicada = aliq.aliquotaEfetiva * (1 - percentualExcluido);
      return { tipo, receita, percentualExcluido, aliquotaAplicada, das: receita * aliquotaAplicada };
    });

    return {
      ...aliq,
      receitaDoMes: baldes.reduce((acc, b) => acc + b.receita, 0),
      dasDevido: baldes.reduce((acc, b) => acc + b.das, 0),
      baldes,
    };
  }

  /**
   * Mesma lógica mês-a-mês de CalcularRbt12UseCase, só que pro próprio mês de competência
   * (não os 12 anteriores) -- duplicada de propósito, são regras de domínio pequenas e
   * independentes. Comércio/indústria agora agrega por ITEM (não por nota inteira) pra
   * categorizar cada item por CST -- pequena divergência possível com o valor da nota
   * (frete/desconto no cabeçalho não entram no somatório de item), aceitável pro propósito
   * de segregação. Serviço sempre vem manual (sem CST pra categorizar), fica 100% normal.
   */
  private async obterReceitaSegregadaDoMes(
    empresaId: string,
    competencia: string,
  ): Promise<{ comercioIndustria: ReceitaPorCategoria; servico: ReceitaPorCategoria }> {
    const fim = ultimoDiaDoMes(competencia);
    const [notas, manuais] = await Promise.all([
      this.notasFiscaisRepositorio.listarPorPeriodo(empresaId, competencia, fim),
      this.receitasRepositorio.listarPorPeriodo(empresaId, competencia, competencia),
    ]);

    const notasSaidaAprovadas = notas.filter((n) => n.direcao === 'saida' && n.status === 'aprovada');
    const comercioIndustria = receitaVazia();

    if (notasSaidaAprovadas.length > 0) {
      const itens = await this.notasFiscaisRepositorio.listarItensPorNotas(notasSaidaAprovadas.map((n) => n.id));
      for (const item of itens) {
        const categoria = categorizarItem(item);
        comercioIndustria[categoria] += item.valorTotal;
      }
    } else {
      const manualComercio = manuais.find((r) => r.tipoAtividade === 'comercio_industria')?.valor ?? 0;
      comercioIndustria.normal = manualComercio;
    }

    const servico = receitaVazia();
    servico.normal = manuais.find((r) => r.tipoAtividade === 'servico')?.valor ?? 0;

    return { comercioIndustria, servico };
  }
}
