import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DebitarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/debitar-creditos.usecase';
import { EstornarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/estornar-creditos.usecase';
import { custoDaOperacao } from '../../../creditos/dominio/credito';
import {
  ASSINATURAS_REPOSITORIO,
  AssinaturasRepositorioPort,
} from '../../../assinaturas/aplicacao/portas/assinaturas-repositorio.port';
import {
  EMPRESAS_REPOSITORIO,
  Empresa,
  EmpresasRepositorioPort,
} from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../../../serpro/aplicacao/portas/consultas-serpro-repositorio.port';
import { SERPRO_GATEWAY, SerproGatewayPort } from '../../../serpro/aplicacao/portas/serpro-gateway.port';
import {
  VERIFICAR_ACESSO_SERPRO,
  VerificarAcessoSerproPort,
} from '../../../serpro/aplicacao/portas/verificar-acesso-serpro.port';
import { RegimeDas, competenciaParaAAAAMM, vencimentoPadrao } from '../../dominio/das';
import { StorageDasService } from '../../infraestrutura/storage-das.service';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';
import { VerificarCotaIncluidaUseCase } from './verificar-cota-incluida.usecase';

const ID_SISTEMA_PGMEI = 'PGMEI';
const ID_SERVICO_GERAR_DAS_PDF_MEI = 'GERARDASPDF21';

const ID_SISTEMA_PGDASD = 'PGDASD';
const ID_SERVICO_CONSULTAR_DECLARACOES = 'CONSDECLARACAO13';
const ID_SERVICO_CONSULTAR_EXTRATO = 'CONSEXTRATO16';

const ID_SISTEMA_PAGTOWEB = 'PAGTOWEB';
const ID_SERVICO_CONSULTAR_PAGAMENTOS = 'PAGAMENTOS71';

const CUSTO_MEI = 'DAS';
const CUSTO_SIMPLES_NACIONAL = 'PGDAS';
const CUSTO_PAGAMENTO = 'CONSULTA_PAGAMENTO_DAS';

/** Janela de competências verificadas por sync -- mês atual + 2 anteriores (mesmo raciocínio de "sem paginação automática" do caixa_postal: cobrir tudo historicamente custaria crédito sem limite). */
const MESES_JANELA_SINCRONIZACAO = 3;

interface ResultadoSincronizacao {
  competenciasNovas: number;
  pagamentosAtualizados: number;
}

/**
 * Sincroniza o DAS de UMA empresa com o SERPRO. Chamado pelo cron (todas as empresas
 * mei/simples_nacional) e pelo endpoint manual `POST .../das/sincronizar` (uma só, sob
 * demanda). Nunca reimplementa envelope/auth/erro do gateway -- só orquestra.
 *
 * STATUS DE CONFIRMAÇÃO (testado contra o ambiente trial real em 2026-10-20, não só
 * lendo doc -- mesma prática já usada em caixa_postal/CCMEI):
 * - `CONSDECLARACAO13`/`extrairDeclaracoes` e `CONSEXTRATO16`/`extrairExtrato`:
 *   CONFIRMADOS com chamada real (CNPJ trial 00000000000000). Nenhum dos dois devolve
 *   valor/vencimento estruturado -- só `dasPago` (via CONSDECLARACAO13) e o PDF em
 *   base64 (via CONSEXTRATO16). `valorDas` fica `null` até existir uma fonte
 *   estruturada confirmada; `vencimento` usa `vencimentoPadrao()` (regra legal
 *   aproximada: dia 20 do mês seguinte).
 * - `GERARDASPDF21`/`extrairDasMei` e `PAGAMENTOS71`/`extrairPagamentos`: **NÃO
 *   confirmados** -- toda tentativa real contra o trial (3 CNPJs de demonstração
 *   diferentes testados) devolveu "Dados inválidos". O parser é a melhor inferência a
 *   partir da doc, mas o shape de sucesso nunca foi observado de verdade. Antes de
 *   confiar em produção, repetir o teste real (ver docs/SEGURANCA.md §3) e ajustar.
 */
@Injectable()
export class SincronizarDasEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(VERIFICAR_ACESSO_SERPRO) private readonly verificarAcesso: VerificarAcessoSerproPort,
    @Inject(SERPRO_GATEWAY) private readonly gateway: SerproGatewayPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasRepositorio: ConsultasSerproRepositorioPort,
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
    private readonly storage: StorageDasService,
    private readonly debitarCreditos: DebitarCreditosUseCase,
    private readonly estornarCreditos: EstornarCreditosUseCase,
    private readonly verificarCotaIncluida: VerificarCotaIncluidaUseCase,
  ) {}

  async executar(empresaId: string): Promise<ResultadoSincronizacao> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }
    if (empresa.regimeTributario !== 'mei' && empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('Módulo de DAS só se aplica a empresas MEI ou Simples Nacional ME/EPP');
    }

    const acesso = await this.verificarAcesso.possuiAcessoValido(empresaId);
    if (!acesso.valido) {
      throw new ForbiddenException(acesso.motivo ?? 'Empresa sem acesso válido ao SERPRO');
    }

    const assinatura = await this.assinaturasRepositorio.buscarAtivaPorEmpresa(empresaId);
    if (!assinatura) {
      throw new ForbiddenException('Empresa sem plano de créditos ativo -- contate seu contador');
    }

    const competenciasNovas =
      empresa.regimeTributario === 'mei'
        ? await this.sincronizarMei(empresa, assinatura.planoId)
        : await this.sincronizarSimplesNacional(empresa, assinatura.planoId);

    const pagamentosAtualizados = await this.verificarPagamentos(empresa, assinatura.planoId);

    return { competenciasNovas, pagamentosAtualizados };
  }

  private async sincronizarMei(empresa: Empresa, planoId: string | null): Promise<number> {
    const existentes = new Set((await this.dasRepositorio.listarPorEmpresa(empresa.id, 'mei')).map((item) => item.competencia));

    let novas = 0;
    for (const competencia of this.ultimasCompetencias()) {
      if (existentes.has(competencia)) continue;

      const resposta = await this.chamarServico(empresa, planoId, {
        idSistema: ID_SISTEMA_PGMEI,
        idServico: ID_SERVICO_GERAR_DAS_PDF_MEI,
        dados: JSON.stringify({ periodoApuracao: competenciaParaAAAAMM(competencia) }),
        custoOperacao: CUSTO_MEI,
        motivo: `Sincronizar DAS MEI -- competência ${competencia}`,
      });
      if (!resposta.sucesso) continue; // já estornado/registrado dentro de chamarServico; segue tentando os outros meses.

      const dasGerado = this.extrairDasMei(resposta.corpo, competencia);
      if (!dasGerado) continue;

      const pdfStorageRef = dasGerado.pdfBase64 ? await this.storage.armazenar(empresa.id, competencia, dasGerado.pdfBase64) : null;

      await this.dasRepositorio.upsertMei({
        empresaId: empresa.id,
        competencia,
        numeroDocumento: dasGerado.numeroDocumento,
        codigoBarras: dasGerado.codigoBarras,
        valor: dasGerado.valor,
        vencimento: dasGerado.vencimento,
        pdfStorageRef,
      });
      novas++;
    }
    return novas;
  }

  private async sincronizarSimplesNacional(empresa: Empresa, planoId: string | null): Promise<number> {
    const respostaDeclaracoes = await this.chamarServico(empresa, planoId, {
      idSistema: ID_SISTEMA_PGDASD,
      idServico: ID_SERVICO_CONSULTAR_DECLARACOES,
      dados: JSON.stringify({ anoCalendario: String(new Date().getFullYear()) }),
      custoOperacao: CUSTO_SIMPLES_NACIONAL,
      motivo: 'Sincronizar DAS Simples Nacional -- consultar declarações transmitidas',
    });
    if (!respostaDeclaracoes.sucesso) return 0;

    const declaracoes = this.extrairDeclaracoes(respostaDeclaracoes.corpo);
    const existentes = new Set(
      (await this.dasRepositorio.listarPorEmpresa(empresa.id, 'simples_nacional')).map((item) => item.competencia),
    );

    let novas = 0;
    for (const declaracao of declaracoes) {
      if (existentes.has(declaracao.competencia)) continue;

      const respostaExtrato = await this.chamarServico(empresa, planoId, {
        idSistema: ID_SISTEMA_PGDASD,
        idServico: ID_SERVICO_CONSULTAR_EXTRATO,
        dados: JSON.stringify({ numeroDas: declaracao.numeroDas }),
        custoOperacao: CUSTO_SIMPLES_NACIONAL,
        motivo: `Sincronizar DAS Simples Nacional -- extrato ${declaracao.numeroDas}`,
      });
      if (!respostaExtrato.sucesso) continue;

      const extrato = this.extrairExtrato(respostaExtrato.corpo);
      if (!extrato) continue;

      const pdfStorageRef = extrato.pdfBase64
        ? await this.storage.armazenar(empresa.id, declaracao.competencia, extrato.pdfBase64)
        : null;

      await this.dasRepositorio.upsertSimplesNacional({
        empresaId: empresa.id,
        competencia: declaracao.competencia,
        numeroDas: declaracao.numeroDas,
        // valor estruturado não confirmado em nenhum serviço PGDASD (CONSEXTRATO16 só
        // devolve {numeroDas, extrato:{nomeArquivo,pdf}} -- confirmado contra o trial) --
        // null em vez de fabricar 0, o PDF tem o valor impresso.
        valorDas: null,
        vencimento: vencimentoPadrao(declaracao.competencia),
        pdfStorageRef,
        // CONSDECLARACAO13 já informa isso direto (indiceDas.dasPago) -- confirmado
        // contra o trial, sem precisar de PAGTOWEB pra Simples Nacional.
        dasPago: declaracao.dasPago,
      });
      novas++;
    }
    return novas;
  }

  /** Só MEI -- Simples Nacional já recebe `dasPago` direto de CONSDECLARACAO13 (ver sincronizarSimplesNacional). */
  private async verificarPagamentos(empresa: Empresa, planoId: string | null): Promise<number> {
    if (empresa.regimeTributario !== 'mei') return 0;
    const regime: RegimeDas = 'mei';
    const pendentes = await this.dasRepositorio.listarPendentesComNumeroDocumento(empresa.id, regime);
    if (pendentes.length === 0) return 0;

    const resposta = await this.chamarServico(empresa, planoId, {
      idSistema: ID_SISTEMA_PAGTOWEB,
      idServico: ID_SERVICO_CONSULTAR_PAGAMENTOS,
      dados: JSON.stringify({
        numeroDocumentoLista: pendentes.map((item) => item.numeroDocumento),
        tamanhoDaPagina: 100,
        primeiroDaPagina: 0,
      }),
      custoOperacao: CUSTO_PAGAMENTO,
      motivo: `Verificar pagamento de ${pendentes.length} DAS pendente(s)`,
    });
    if (!resposta.sucesso) return 0;

    const pagos = this.extrairPagamentos(resposta.corpo);
    let atualizados = 0;
    for (const item of pendentes) {
      const pagamento = pagos.find((p) => p.numeroDocumento === item.numeroDocumento);
      if (!pagamento) continue;
      await this.dasRepositorio.marcarComoPago(item.id, regime, pagamento.dataArrecadacao);
      atualizados++;
    }
    return atualizados;
  }

  /** Mês atual + os `MESES_JANELA_SINCRONIZACAO - 1` anteriores, como datas (AAAA-MM-01) -- mais recente primeiro. */
  private ultimasCompetencias(): string[] {
    const hoje = new Date();
    const competencias: string[] = [];
    for (let i = 0; i < MESES_JANELA_SINCRONIZACAO; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      competencias.push(data.toISOString().slice(0, 10));
    }
    return competencias;
  }

  /** Saga completa (cota incluída -> débito -> chamada -> estorno-se-falhar -> log) -- reusada por toda chamada SERPRO deste usecase. */
  private async chamarServico(
    empresa: Empresa,
    planoId: string | null,
    params: { idSistema: string; idServico: string; dados: string; custoOperacao: string; motivo: string },
  ): Promise<{ sucesso: boolean; corpo: unknown }> {
    // Dentro da cota incluída no plano (ex: "1 PGDASD/mês"), a consulta não debita do pool
    // fungível de créditos -- fora dela, segue o fluxo normal de débito/estorno.
    const dentroDaCota = await this.verificarCotaIncluida.executar(empresa.id, planoId, params.idSistema);
    if (!dentroDaCota) {
      await this.debitarCreditos.executar(empresa.contadorId, empresa.id, params.custoOperacao, params.motivo);
    }

    let sucesso = false;
    let codigoErro: string | null = null;
    let corpo: unknown = null;

    try {
      const resposta = await this.gateway.consultar({
        idSistema: params.idSistema,
        idServico: params.idServico,
        contribuinteCnpj: empresa.cnpj,
        dados: params.dados,
      });
      sucesso = resposta.sucesso;
      corpo = resposta.corpo;
      if (!sucesso) codigoErro = `HTTP_${resposta.statusHttp}`;
    } catch {
      codigoErro = 'ERRO_COMUNICACAO';
    }

    if (!sucesso && !dentroDaCota) {
      await this.estornarCreditos.executar(
        empresa.contadorId,
        empresa.id,
        custoDaOperacao(params.custoOperacao),
        `${params.motivo} falhou (${codigoErro})`,
      );
    }

    await this.consultasRepositorio.registrar({
      contadorId: empresa.contadorId,
      empresaId: empresa.id,
      idSistema: params.idSistema,
      idServico: params.idServico,
      sucesso,
      codigoErro,
      creditosConsumidos: sucesso && !dentroDaCota ? custoDaOperacao(params.custoOperacao) : 0,
    });

    return { sucesso, corpo };
  }

  /**
   * `corpo.dados` é string com JSON aninhado (mesmo formato confirmado em
   * caixa_postal/CCMEI/CONSDECLARACAO13). IMPORTANTE: este parser é a melhor inferência
   * a partir da documentação (`detalhamento[]`/`pdf`) -- toda tentativa real contra o
   * ambiente trial (3 CNPJs de demonstração testados: 00000000000000, 99999999999999,
   * 00000000000100) devolveu "Dados inválidos", então o shape de SUCESSO nunca foi
   * confirmado de verdade (diferente de CONSDECLARACAO13/CONSEXTRATO16 abaixo, que
   * foram). Ajustar aqui antes de confiar em produção -- ver nota de risco no topo do
   * arquivo.
   */
  private extrairDasMei(
    corpo: unknown,
    competencia: string,
  ): { pdfBase64: string | null; numeroDocumento: string | null; codigoBarras: string | null; valor: number | null; vencimento: string } | null {
    try {
      const corpoObj = corpo as { dados?: string };
      if (!corpoObj?.dados) return null;
      const parsed = JSON.parse(corpoObj.dados) as {
        pdf?: string;
        detalhamento?: Array<{ numeroDocumento?: string; codigoDeBarras?: string; valor?: number; dataVencimento?: string }>;
      };
      const detalhe = parsed.detalhamento?.[0];
      if (!detalhe && !parsed.pdf) return null;
      return {
        pdfBase64: parsed.pdf ?? null,
        numeroDocumento: detalhe?.numeroDocumento ?? null,
        codigoBarras: detalhe?.codigoDeBarras ?? null,
        valor: detalhe?.valor ?? null,
        vencimento: detalhe?.dataVencimento ?? vencimentoPadrao(competencia),
      };
    } catch {
      return null;
    }
  }

  /**
   * CONFIRMADO contra o ambiente trial real (CNPJ 00000000000000, anoCalendario
   * ignorado pelo cenário de demonstração -- sempre devolve 2018): a resposta é
   * `{anocalendario, periodos:[{periodoApuracao:201801, operacoes:[{tipoOperacao,
   * indiceDeclaracao:{numeroDeclaracao,...}|null, indiceDas:{numeroDas,
   * datahoraEmissaoDas,dasPago}|null}]}]}` -- NÃO tem valor/vencimento estruturado em
   * lugar nenhum. Cada período pode ter mais de uma operação "Geração de DAS"
   * (retificação gera um DAS novo) -- pega a última da lista (mais recente).
   */
  private extrairDeclaracoes(corpo: unknown): Array<{ competencia: string; numeroDas: string; dasPago: boolean }> {
    try {
      const corpoObj = corpo as { dados?: string };
      if (!corpoObj?.dados) return [];
      const parsed = JSON.parse(corpoObj.dados) as {
        periodos?: Array<{
          periodoApuracao: number;
          operacoes: Array<{ tipoOperacao: string; indiceDas: { numeroDas: string; dasPago: boolean } | null }>;
        }>;
      };
      const resultado: Array<{ competencia: string; numeroDas: string; dasPago: boolean }> = [];
      for (const periodo of parsed.periodos ?? []) {
        const geracoesDas = periodo.operacoes.filter((op) => op.indiceDas !== null);
        const maisRecente = geracoesDas[geracoesDas.length - 1];
        if (!maisRecente?.indiceDas) continue;
        resultado.push({
          competencia: this.aaaammParaCompetencia(String(periodo.periodoApuracao)),
          numeroDas: maisRecente.indiceDas.numeroDas,
          dasPago: maisRecente.indiceDas.dasPago,
        });
      }
      return resultado;
    } catch {
      return [];
    }
  }

  /**
   * CONFIRMADO contra o ambiente trial real: a resposta é
   * `{numeroDas, extrato:{nomeArquivo, pdf}}` -- SEM valor/vencimento estruturado (só o
   * PDF em base64, que tem o valor impresso visualmente).
   */
  private extrairExtrato(corpo: unknown): { pdfBase64: string | null } | null {
    try {
      const corpoObj = corpo as { dados?: string };
      if (!corpoObj?.dados) return null;
      const parsed = JSON.parse(corpoObj.dados) as { extrato?: { pdf?: string } };
      if (!parsed.extrato) return null;
      return { pdfBase64: parsed.extrato.pdf ?? null };
    } catch {
      return null;
    }
  }

  private extrairPagamentos(corpo: unknown): Array<{ numeroDocumento: string; dataArrecadacao: string }> {
    try {
      const corpoObj = corpo as { dados?: string };
      if (!corpoObj?.dados) return [];
      const parsed = JSON.parse(corpoObj.dados) as {
        documentosArrecadacao?: Array<{ numeroDocumento?: string; dataArrecadacaoTributo?: string }>;
      };
      return (parsed.documentosArrecadacao ?? [])
        .filter((d) => d.numeroDocumento)
        .map((d) => ({
          numeroDocumento: d.numeroDocumento as string,
          dataArrecadacao: d.dataArrecadacaoTributo ?? new Date().toISOString(),
        }));
    } catch {
      return [];
    }
  }

  private aaaammParaCompetencia(aaaamm: string): string {
    if (aaaamm.length !== 6) return new Date().toISOString().slice(0, 10);
    return `${aaaamm.slice(0, 4)}-${aaaamm.slice(4, 6)}-01`;
  }
}
