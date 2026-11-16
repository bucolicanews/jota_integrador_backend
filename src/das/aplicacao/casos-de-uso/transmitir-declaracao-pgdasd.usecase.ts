import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CalcularApuracaoSimplesUseCase, ResultadoApuracaoSimples, SegregacaoApurada } from '../../../apuracao-simples/aplicacao/casos-de-uso/calcular-apuracao-simples.usecase';
import { RECEITAS_MENSAIS_REPOSITORIO, ReceitasMensaisRepositorioPort } from '../../../apuracao-simples/aplicacao/portas/receitas-mensais-repositorio.port';
import { ChaveAtividadeServico } from '../../../apuracao-simples/dominio/catalogo-anexos-simples';
import { EMPRESAS_REPOSITORIO, Empresa, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { VERIFICAR_ACESSO_SERPRO, VerificarAcessoSerproPort } from '../../../serpro/aplicacao/portas/verificar-acesso-serpro.port';
import { ExigirAssinaturaAtivaUseCase } from '../../../assinaturas/aplicacao/casos-de-uso/exigir-assinatura-ativa.usecase';
import { competenciaParaAAAAMM } from '../../dominio/das';
import { AnexoNaoSuportadoPgdasdError, resolverIdAtividadeComercioIndustria, resolverIdAtividadeServico } from '../../dominio/id-atividade-pgdasd';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';
import { ChamarServicoSerproComCreditoService } from './chamar-servico-serpro-com-credito.service';
import { GerarSegundaViaDasUseCase } from './gerar-segunda-via-das.usecase';

const ID_SISTEMA_PGDASD = 'PGDASD';
const ID_SERVICO_TRANSMITIR_DECLARACAO = 'TRANSDECLARACAO11';
const CUSTO_SIMPLES_NACIONAL = 'PGDAS';

export interface ResultadoTransmissaoPgdasd {
  competencia: string;
  numeroDeclaracao: string | null;
  transmitido: boolean;
  dasGerado: boolean;
  dasId: string | null;
  url: string | null;
  expiraEmSegundos: number | null;
  motivoFalhaDas: string | null;
}

/**
 * TRANSDECLARACAO11 (PGDASD, funcionalidade `Declarar`) -- NUNCA testado contra o SERPRO
 * até a escrita deste usecase (2026-11-14). Payload reconstruído via fragmentos indexados
 * da doc oficial (página `dados_de_dominio` retornando HTTP 500 real no momento da
 * pesquisa, ver `src/das/dominio/id-atividade-pgdasd.ts`) -- toda chamada real PRECISA
 * passar primeiro pelo ambiente trial (CNPJ `00000000000000`) antes de confiar nisto
 * contra uma empresa de cliente de verdade. Mesma disciplina já aplicada em
 * `GERARDAS12`/`GERARDASPDF21` (doc oficial errou campo/formato nos dois -- esperado
 * que erre aqui também).
 *
 * Escopo da v1 (ver plano): só Anexo I/II (comércio/indústria) e III/IV (serviço) --
 * Anexo V bloqueado (código idAtividade nunca confirmado), e receita com PIS/COFINS já
 * recolhido por ST/monofásico isolado também bloqueada (tabela de idAtividade encontrada
 * só distingue tratamento de ICMS/ISS, não PIS/COFINS). RBT12 continua bruto -- nenhuma
 * mudança nisso, só decide o idAtividade/payload do mês sendo transmitido.
 */
@Injectable()
export class TransmitirDeclaracaoPgdasdUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(VERIFICAR_ACESSO_SERPRO) private readonly verificarAcesso: VerificarAcessoSerproPort,
    @Inject(RECEITAS_MENSAIS_REPOSITORIO) private readonly receitasRepositorio: ReceitasMensaisRepositorioPort,
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
    private readonly exigirAssinaturaAtiva: ExigirAssinaturaAtivaUseCase,
    private readonly calcularApuracaoSimples: CalcularApuracaoSimplesUseCase,
    private readonly chamarServico: ChamarServicoSerproComCreditoService,
    private readonly gerarSegundaVia: GerarSegundaViaDasUseCase,
  ) {}

  async executar(
    empresaId: string,
    competencia: string,
    chaveAtividadeServico?: ChaveAtividadeServico,
    dataConsolidacaoIso?: string,
  ): Promise<ResultadoTransmissaoPgdasd> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new ForbiddenException('Empresa não encontrada');
    if (empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('Transmissão de declaração só se aplica a empresas do Simples Nacional ME/EPP');
    }

    const acesso = await this.verificarAcesso.possuiAcessoValido(empresaId);
    if (!acesso.valido) throw new ForbiddenException(acesso.motivo ?? 'Empresa sem acesso válido ao SERPRO');

    const existentes = await this.dasRepositorio.listarPorEmpresa(empresaId, 'simples_nacional');
    if (existentes.some((item) => item.competencia === competencia)) {
      throw new BadRequestException(
        'Já existe declaração/DAS sincronizado pra esta competência -- esta ação não suporta retificação, lance manualmente no Portal do Simples Nacional se precisar corrigir.',
      );
    }

    const planoId = await this.exigirAssinaturaAtiva.executar(empresaId);

    const apuracao = await this.calcularApuracaoSimples.executar(empresaId, competencia, chaveAtividadeServico);
    const dados = await this.montarPayload(empresa, competencia, apuracao, chaveAtividadeServico);

    const resposta = await this.chamarServico.executar(empresa, planoId, {
      idSistema: ID_SISTEMA_PGDASD,
      idServico: ID_SERVICO_TRANSMITIR_DECLARACAO,
      dados: JSON.stringify(dados),
      custoOperacao: CUSTO_SIMPLES_NACIONAL,
      motivo: `Transmitir declaração PGDAS-D -- competência ${competencia}`,
      funcionalidade: 'Declarar',
    });

    if (!resposta.sucesso) {
      throw new BadRequestException('SERPRO rejeitou a transmissão da declaração -- confira os dados apurados e tente novamente');
    }

    const numeroDeclaracao = this.extrairNumeroDeclaracao(resposta.corpo);

    const dasCriado = await this.dasRepositorio.upsertSimplesNacional({
      empresaId,
      competencia,
      numeroDas: numeroDeclaracao ?? `TRANSMITIDO-${competenciaParaAAAAMM(competencia)}`,
      valorDas: apuracao.dasTotalCalculado,
      vencimento: this.calcularVencimento(competencia),
      pdfStorageRef: null,
      dasPago: false,
      numeroDeclaracao,
      reciboStorageRef: null,
      declaracaoStorageRef: null,
    });

    try {
      const segundaVia = await this.gerarSegundaVia.executar(empresaId, dasCriado.id, dataConsolidacaoIso);
      return {
        competencia,
        numeroDeclaracao,
        transmitido: true,
        dasGerado: true,
        dasId: dasCriado.id,
        url: segundaVia.url,
        expiraEmSegundos: segundaVia.expiraEmSegundos,
        motivoFalhaDas: null,
      };
    } catch (erro) {
      // A declaração JÁ foi transmitida de verdade nesse ponto -- nunca escondido como
      // falha total. Gerar o DAS pode ser repetido depois via POST .../segunda-via.
      return {
        competencia,
        numeroDeclaracao,
        transmitido: true,
        dasGerado: false,
        dasId: dasCriado.id,
        url: null,
        expiraEmSegundos: null,
        motivoFalhaDas: (erro as Error).message,
      };
    }
  }

  private calcularVencimento(competencia: string): string {
    const [ano, mes] = competencia.split('-').map(Number);
    return new Date(ano, mes, 20).toISOString().slice(0, 10);
  }

  private extrairNumeroDeclaracao(corpo: unknown): string | null {
    try {
      const corpoObj = corpo as { dados?: string };
      if (!corpoObj?.dados) return null;
      const parsed = JSON.parse(corpoObj.dados) as { numeroDeclaracao?: string };
      return parsed.numeroDeclaracao ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Payload reconstruído da doc oficial (ver comentário de classe) -- `isencoes`/
   * `reducoes`/`qualificacoesTributarias`/`exigibilidadesSuspensas` vazios (empresa sem
   * regime especial, única hipótese coberta na v1). `tipoDeclaracao`/
   * `indicadorComparacao` são confiança baixa/média -- primeiro alvo a confirmar contra
   * o trial.
   */
  private async montarPayload(
    empresa: Empresa,
    competencia: string,
    apuracao: ResultadoApuracaoSimples,
    chaveAtividadeServico: ChaveAtividadeServico | undefined,
  ): Promise<Record<string, unknown>> {
    const atividades: Array<{ idAtividade: number; valorAtividade: number; receitasAtividade: unknown[] }> = [];

    this.adicionarAtividadesComercioIndustria(atividades, apuracao.comercioIndustria);

    if (apuracao.servico) {
      if (!chaveAtividadeServico) {
        throw new BadRequestException('Há receita de serviço no mês -- informe a atividade de serviço pra transmitir a declaração.');
      }
      await this.adicionarAtividadeServico(atividades, apuracao.servico, competencia, empresa.id, chaveAtividadeServico);
    }

    if (atividades.length === 0) {
      throw new BadRequestException('Não há receita apurada pra esta competência -- nada a transmitir.');
    }

    const receitaTotal = atividades.reduce((acc, a) => acc + a.valorAtividade, 0);

    return {
      cnpjCompleto: empresa.cnpj,
      pa: Number(competenciaParaAAAAMM(competencia)),
      indicadorTransmissao: true,
      indicadorComparacao: false,
      declaracao: {
        tipoDeclaracao: 1,
        receitaPaCompetenciaInterno: receitaTotal,
        receitaPaCompetenciaExterno: 0,
        receitaPaCaixaInterno: 0,
        receitaPaCaixaExterno: 0,
        estabelecimentos: [{ cnpjCompleto: empresa.cnpj, atividades }],
      },
    };
  }

  /** Comércio/indústria -- bloqueia (lança erro) se houver receita com PIS/COFINS já recolhido isolado, que esta v1 não sabe representar. */
  private adicionarAtividadesComercioIndustria(
    atividades: Array<{ idAtividade: number; valorAtividade: number; receitasAtividade: unknown[] }>,
    segregacao: SegregacaoApurada,
  ): void {
    for (const balde of segregacao.baldes) {
      if (balde.receita <= 0) continue;
      if (balde.tipo === 'pis_cofins_ja_recolhido' || balde.tipo === 'ambos_ja_recolhidos') {
        throw new BadRequestException(
          'Há receita de comércio/indústria com PIS/COFINS já recolhido por substituição/monofásico -- esta v1 ainda não suporta declarar isso automaticamente, lance manualmente no Portal do Simples Nacional.',
        );
      }
      const temIcmsSt = balde.tipo === 'icms_ja_recolhido';
      atividades.push({
        idAtividade: resolverIdAtividadeComercioIndustria(segregacao.anexo, temIcmsSt),
        valorAtividade: balde.receita,
        receitasAtividade: [{ valor: balde.receita, isencoes: [], reducoes: [], qualificacoesTributarias: [], exigibilidadesSuspensas: [] }],
      });
    }
  }

  private async adicionarAtividadeServico(
    atividades: Array<{ idAtividade: number; valorAtividade: number; receitasAtividade: unknown[] }>,
    segregacao: SegregacaoApurada,
    competencia: string,
    empresaId: string,
    chaveAtividadeServico: ChaveAtividadeServico,
  ): Promise<void> {
    if (segregacao.receitaDoMes <= 0) return;

    const temPisCofinsOuAmbos = segregacao.baldes.some(
      (b) => (b.tipo === 'pis_cofins_ja_recolhido' || b.tipo === 'ambos_ja_recolhidos') && b.receita > 0,
    );
    if (temPisCofinsOuAmbos) {
      throw new BadRequestException(
        'Há receita de serviço com PIS/COFINS já recolhido por substituição/monofásico -- esta v1 ainda não suporta declarar isso automaticamente.',
      );
    }

    const receitasDoMes = await this.receitasRepositorio.listarPorPeriodo(empresaId, competencia, competencia);
    const receitaServico = receitasDoMes.find((r) => r.tipoAtividade === 'servico');
    const issRetidoNaFonte = receitaServico?.issRetidoNaFonte ?? false;
    const issDevidoAOutroMunicipio = receitaServico?.issDevidoAOutroMunicipio ?? false;

    let idAtividade: number;
    try {
      idAtividade = resolverIdAtividadeServico(segregacao.anexo, chaveAtividadeServico, issRetidoNaFonte, issDevidoAOutroMunicipio);
    } catch (erro) {
      if (erro instanceof AnexoNaoSuportadoPgdasdError) throw new BadRequestException(erro.message);
      throw erro;
    }

    atividades.push({
      idAtividade,
      valorAtividade: segregacao.receitaDoMes,
      receitasAtividade: [
        {
          valor: segregacao.receitaDoMes,
          // Código IBGE do município do tomador -- não capturado ainda (gap de dados do
          // plano), mesmo quando issDevidoAOutroMunicipio=true.
          codigoOutroMunicipio: null,
          isencoes: [],
          reducoes: [],
          qualificacoesTributarias: [],
          exigibilidadesSuspensas: [],
        },
      ],
    });
  }
}
