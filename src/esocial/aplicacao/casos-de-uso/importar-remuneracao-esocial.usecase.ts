import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { SupabaseService } from '../../../common/supabase/supabase.service';
import { CriarContaPagarUseCase } from '../../../contas-a-pagar/aplicacao/casos-de-uso/criar-conta-pagar.usecase';
import { ultimoDiaDoMes } from '../../../apuracao-simples/dominio/receita-mensal';
import { ClassificacaoTrabalhador, inferirClassificacaoPorCodCateg, parseXmlEvtRemun } from '../../dominio/parser-xml-evt-remun';
import { ConfiguracaoLancamentosEsocial, ESOCIAL_REPOSITORIO, EsocialRepositorioPort } from '../portas/esocial-repositorio.port';

export type { ClassificacaoTrabalhador };

export interface ArquivoRemuneracaoParaImportar {
  xml: string;
  /** Omitido = tenta inferir pelo codCateg do XML (ver inferirClassificacaoPorCodCateg);
   * quando informado, sempre vence a inferência (usuário corrigindo manualmente). */
  classificacao?: ClassificacaoTrabalhador;
}

export interface DadosImportarRemuneracaoEsocial {
  empresaId: string;
  arquivos: ArquivoRemuneracaoParaImportar[];
  /** false = só calcula e devolve o preview, não cria nada -- alimenta a tela de
   * confirmação antes de gravar algo contábil de verdade. */
  confirmar: boolean;
  usuarioAtualId: string;
}

export interface ArquivoRemuneracaoProcessado {
  cpfTrab: string;
  codCateg: string;
  /** Resultado final usado no cálculo -- da inferência por codCateg, ou do override manual do arquivo. */
  classificacao: ClassificacaoTrabalhador | null;
  bruto: number;
  inss: number;
}

export interface ResultadoImportacaoRemuneracao {
  /** [] quando confirmar=false (só preview, nada foi criado ainda). */
  contasPagarIds: string[];
  competencia: string;
  brutoSalarios: number;
  brutoProLabore: number;
  totalInss: number;
  totalFgts: number;
  /** Por arquivo -- front usa pra mostrar o que foi detectado e deixar corrigir antes de confirmar. */
  arquivos: ArquivoRemuneracaoProcessado[];
}

/** Número da rubrica eSocial pra INSS -- fixo, confirmado contra 2 XMLs reais (ver sessão de análise 2026-11-16). */
const NUMERO_RUBRICA_INSS = 71;

/**
 * Soma bruto (proventos) e INSS (rubrica 71) por classificação e cria uma Conta a Pagar
 * (CriarContaPagarUseCase, mesmo caminho de contas a pagar de nota fiscal) por item --
 * Salário, Pró-labore, INSS e FGTS (opcional) -- cada uma com débito despesa + crédito
 * passivo próprios. Decisão explícita do contador (sessão 2026-11-16): tratar INSS/FGTS
 * como título "a pagar" própria, com despesa dedicada, em troca de ter vencimento/parcela
 * rastreado igual qualquer fornecedor -- mesmo isso recontando como despesa um valor que já
 * compõe o bruto de salário/pró-labore (trade-off aceito, não é a contabilização "pura").
 * Nunca cria tabela paralela de "folha mensal": o Fator R (CalcularFatorRUseCase) já lê
 * direto do movimento das contas marcadas conta_folha_pagamento, então os lançamentos que o
 * CriarContaPagarUseCase já gera por fora bastam.
 */
@Injectable()
export class ImportarRemuneracaoEsocialUseCase {
  constructor(
    @Inject(ESOCIAL_REPOSITORIO) private readonly esocialRepositorio: EsocialRepositorioPort,
    private readonly criarContaPagar: CriarContaPagarUseCase,
    private readonly supabase: SupabaseService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosImportarRemuneracaoEsocial): Promise<ResultadoImportacaoRemuneracao> {
    if (dados.arquivos.length === 0) {
      throw new BadRequestException('Envie ao menos 1 arquivo S-1200');
    }

    // Preview (confirmar=false) não exige a configuração ainda -- só calcula os números pra
    // mostrar na tela antes do contador decidir. Confirmar exige, senão não tem pra onde lançar.
    const configuracao = await this.esocialRepositorio.buscarConfiguracaoLancamentos(dados.empresaId);
    if (dados.confirmar && !configuracao) {
      throw new BadRequestException('Configure as contas de lançamento do eSocial antes de importar (Configurações > eSocial)');
    }

    let brutoSalarios = 0;
    let brutoProLabore = 0;
    let inssSalarios = 0;
    let inssProLabore = 0;
    let competencia: string | null = null;
    const arquivosProcessados: ArquivoRemuneracaoProcessado[] = [];
    const semClassificacao: string[] = [];

    for (const arquivo of dados.arquivos) {
      let remuneracao;
      try {
        remuneracao = parseXmlEvtRemun(arquivo.xml);
      } catch (erro: any) {
        throw new BadRequestException(`Falha ao ler XML: ${erro.message}`);
      }

      if (competencia === null) {
        competencia = remuneracao.competencia;
      } else if (competencia !== remuneracao.competencia) {
        throw new BadRequestException(`Arquivos de competências diferentes na mesma importação (${competencia} e ${remuneracao.competencia})`);
      }

      const bruto = remuneracao.itens.filter((i) => i.tipo === 'provento').reduce((soma, i) => soma + i.valor, 0);
      const inss = remuneracao.itens.filter((i) => i.numeroRubrica === NUMERO_RUBRICA_INSS).reduce((soma, i) => soma + i.valor, 0);
      // Override manual (arquivo.classificacao) sempre vence a inferência automática por codCateg.
      const classificacao = arquivo.classificacao ?? inferirClassificacaoPorCodCateg(remuneracao.codCateg);

      if (classificacao === null) {
        semClassificacao.push(remuneracao.cpfTrab);
      } else if (classificacao === 'funcionario') {
        brutoSalarios += bruto;
        inssSalarios += inss;
      } else {
        brutoProLabore += bruto;
        inssProLabore += inss;
      }
      arquivosProcessados.push({ cpfTrab: remuneracao.cpfTrab, codCateg: remuneracao.codCateg, classificacao, bruto, inss });
    }

    if (dados.confirmar && semClassificacao.length > 0) {
      throw new BadRequestException(`Não foi possível identificar automaticamente se é salário ou pró-labore pro(s) CPF(s): ${semClassificacao.join(', ')}. Escolha manualmente antes de confirmar.`);
    }

    const brutoTotal = brutoSalarios + brutoProLabore;
    const totalInss = inssSalarios + inssProLabore;
    const totalFgts = await this.calcularFgts(brutoTotal, competencia!);

    if (!dados.confirmar) {
      return { contasPagarIds: [], competencia: competencia!, brutoSalarios, brutoProLabore, totalInss, totalFgts, arquivos: arquivosProcessados };
    }

    const dataEmissao = `${competencia}-01`;
    const primeiroVencimento = ultimoDiaDoMes(dataEmissao);
    const contasPagarIds: string[] = [];

    const criar = async (fornecedor: string, contaResultadoId: string, contaPatrimonialId: string, valor: number) => {
      const id = await this.criarContaPagar.executar({
        empresaId: dados.empresaId,
        fornecedorId: null,
        fornecedor,
        descricao: `${fornecedor} -- competência ${competencia} (importação S-1200)`,
        contaPatrimonialId,
        contaResultadoId,
        dataEmissao,
        criadoPor: dados.usuarioAtualId,
        modo: 'unico',
        valor,
        quantidadeParcelas: 1,
        primeiroVencimento,
        intervaloDias: 0,
      });
      contasPagarIds.push(id);
    };

    const config = configuracao as ConfiguracaoLancamentosEsocial;
    if (brutoSalarios > 0) await criar('Folha -- Salários', config.contaDespesaSalarioId, config.contaPassivoSalarioAPagarId, brutoSalarios);
    if (brutoProLabore > 0) await criar('Folha -- Pró-labore', config.contaDespesaProLaboreId, config.contaPassivoProLaboreAPagarId, brutoProLabore);
    if (totalInss > 0) await criar('Folha -- INSS a recolher', config.contaDespesaInssId, config.contaPassivoInssId, totalInss);
    if (totalFgts > 0 && config.contaDespesaFgtsId && config.contaPassivoFgtsId) {
      await criar('Folha -- FGTS a recolher', config.contaDespesaFgtsId, config.contaPassivoFgtsId, totalFgts);
    }

    await this.auditoria.registrar({
      usuarioId: dados.usuarioAtualId,
      empresaId: dados.empresaId,
      acao: 'IMPORTAR_REMUNERACAO_ESOCIAL',
      recurso: `empresas:${dados.empresaId}`,
      dadosNovos: { competencia, brutoSalarios, brutoProLabore, totalInss, totalFgts, contasPagarIds, arquivos: dados.arquivos.length },
    });

    return { contasPagarIds, competencia: competencia!, brutoSalarios, brutoProLabore, totalInss, totalFgts, arquivos: arquivosProcessados };
  }

  /** Alíquota FGTS vigente na competência, via tabelas_tributarias -- 0 se não houver tabela cadastrada pra essa data (partida de FGTS simplesmente não entra). */
  private async calcularFgts(brutoTotal: number, competencia: string): Promise<number> {
    const dataCompetencia = `${competencia}-01`;
    const { data, error } = await this.supabase.admin
      .from('tabelas_tributarias')
      .select('parametros')
      .eq('tipo', 'fgts')
      .lte('vigencia_inicio', dataCompetencia)
      .or(`vigencia_fim.is.null,vigencia_fim.gte.${dataCompetencia}`)
      .order('vigencia_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return 0;
    const aliquota = (data.parametros as { aliquota_percentual?: number })?.aliquota_percentual;
    return aliquota ? Math.round(brutoTotal * (aliquota / 100) * 100) / 100 : 0;
  }
}
