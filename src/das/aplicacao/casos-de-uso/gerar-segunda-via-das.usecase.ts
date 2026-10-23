import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { competenciaParaAAAAMM } from '../../dominio/das';
import { StorageDasService } from '../../infraestrutura/storage-das.service';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';
import { VerificarCotaIncluidaUseCase } from './verificar-cota-incluida.usecase';

const ID_SISTEMA_PGDASD = 'PGDASD';
const ID_SERVICO_GERAR_DAS = 'GERARDAS12';
const CUSTO_SIMPLES_NACIONAL = 'PGDAS';

/**
 * 2ª via REAL (boleto com código de barras) -- diferente do Extrato (CONSEXTRATO16,
 * usecase de sincronização), que é só um relatório de apuração. Shape de sucesso
 * (`dados.pdf` + `dados.detalhamento.{numeroDocumento,dataVencimento,valores.total}`)
 * é inferência da documentação oficial do SERPRO (GERARDAS12, sistema PGDASD),
 * escrita em 2026-10-21 -- NUNCA confirmada com chamada real.
 *
 * TESTADO contra o ambiente trial em 2026-10-23 (CNPJ demo `00000000000000`,
 * `declaracoes_pgdas` sintético, mesma técnica já usada pra CONSDECLARACAO13/
 * CONSEXTRATO16): `GERARDAS12` devolveu HTTP 400 ("Dados inválidos"), mesma classe de
 * falha já documentada em `sincronizar-das-empresa.usecase.ts` pra GERARDASPDF21/
 * PAGAMENTOS71 -- não foi possível confirmar se é limitação do ambiente trial (serviço
 * não habilitado fora de produção) ou payload incorreto, já que o corpo bruto do erro
 * nunca é logado (pode conter dado fiscal sensível -- ver SerproGatewayHttp). Repetir
 * contra produção (com autorização explícita) antes de confiar neste shape.
 *
 * Sob demanda (nunca no sync automático/cron) -- o valor muda com juros/multa quando
 * vencido, então sempre gera de novo no clique (não reusa um PDF salvo antes).
 */
@Injectable()
export class GerarSegundaViaDasUseCase {
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

  async executar(empresaId: string, dasId: string, dataConsolidacaoIso?: string): Promise<{ url: string; expiraEmSegundos: number }> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    if (empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('2ª via real só disponível pra empresas do Simples Nacional ME/EPP por enquanto (GERARDAS12 é específico do PGDASD)');
    }

    const acesso = await this.verificarAcesso.possuiAcessoValido(empresaId);
    if (!acesso.valido) {
      throw new ForbiddenException(acesso.motivo ?? 'Empresa sem acesso válido ao SERPRO');
    }

    const item = await this.dasRepositorio.buscarPorId(dasId, 'simples_nacional');
    if (!item || item.empresaId !== empresaId) {
      throw new NotFoundException('DAS não encontrado');
    }

    const assinatura = await this.assinaturasRepositorio.buscarAtivaPorEmpresa(empresaId);
    if (!assinatura) {
      throw new ForbiddenException('Empresa sem plano de créditos ativo -- contate seu contador');
    }

    // SERPRO rejeita "hoje" ou antes (confirmado contra produção: "Data de consolidação
    // em formato incorreto ou anterior/igual à data atual") -- precisa ser estritamente
    // futura. Quem chama escolhe até quando o boleto fica válido pra pagar (ex: fim do
    // mês, pra não precisar reemitir a cada dia de um DAS vencido) -- "amanhã" só como
    // fallback mínimo se nada for informado.
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let dataAlvo: Date;
    if (dataConsolidacaoIso) {
      dataAlvo = new Date(`${dataConsolidacaoIso}T00:00:00`);
      if (Number.isNaN(dataAlvo.getTime()) || dataAlvo <= hoje) {
        throw new BadRequestException('dataConsolidacao precisa ser uma data válida e estritamente futura');
      }
    } else {
      dataAlvo = new Date(hoje);
      dataAlvo.setDate(dataAlvo.getDate() + 1);
    }
    const dataConsolidacao = dataAlvo.toISOString().slice(0, 10).replace(/-/g, '');
    const dentroDaCota = await this.verificarCotaIncluida.executar(empresaId, assinatura.planoId, ID_SISTEMA_PGDASD);
    if (!dentroDaCota) {
      await this.debitarCreditos.executar(empresa.contadorId, empresaId, CUSTO_SIMPLES_NACIONAL, `Gerar 2ª via do DAS -- competência ${item.competencia}`);
    }

    let sucesso = false;
    let codigoErro: string | null = null;
    let corpo: unknown = null;
    try {
      const resposta = await this.gateway.consultar({
        idSistema: ID_SISTEMA_PGDASD,
        idServico: ID_SERVICO_GERAR_DAS,
        contribuinteCnpj: empresa.cnpj,
        dados: JSON.stringify({ periodoApuracao: competenciaParaAAAAMM(item.competencia), dataConsolidacao }),
        // GERARDAS12 é "Emitir", não "Consultar" (confirmado contra a doc oficial depois
        // de um 400 real -- ver comentário em FuncionalidadeSerpro).
        funcionalidade: 'Emitir',
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
        empresaId,
        custoDaOperacao(CUSTO_SIMPLES_NACIONAL),
        `Gerar 2ª via do DAS falhou (${codigoErro})`,
      );
    }

    await this.consultasRepositorio.registrar({
      contadorId: empresa.contadorId,
      empresaId,
      idSistema: ID_SISTEMA_PGDASD,
      idServico: ID_SERVICO_GERAR_DAS,
      sucesso,
      codigoErro,
      creditosConsumidos: sucesso && !dentroDaCota ? custoDaOperacao(CUSTO_SIMPLES_NACIONAL) : 0,
    });

    if (!sucesso) {
      // Confirmado contra produção em 2026-10-21: datas muito à frente (10+ dias, variável
      // dia a dia) estouram a tabela de Taxa Selic que o SERPRO ainda não publicou --
      // mensagem específica pro usuário escolher uma data mais próxima, em vez do genérico.
      const mensagemSelicAusente = this.extrairMensagemSelicAusente(corpo);
      if (mensagemSelicAusente) {
        throw new BadRequestException(
          'O SERPRO ainda não tem a taxa Selic cadastrada pra essa data -- escolha uma data mais próxima (poucos dias no futuro) e tente de novo',
        );
      }
      throw new BadRequestException('Não foi possível gerar a 2ª via junto ao SERPRO agora -- tente novamente em instantes');
    }

    const gerado = this.extrairGerarDas(corpo);
    if (!gerado?.pdfBase64) {
      throw new BadRequestException('SERPRO não devolveu o PDF da 2ª via nesta tentativa');
    }

    const pdfStorageRef = await this.storage.armazenar(empresaId, item.competencia, gerado.pdfBase64);
    await this.dasRepositorio.atualizarSegundaVia(dasId, {
      valorDas: gerado.valorTotal,
      vencimento: gerado.vencimento,
      pdfSegundaViaStorageRef: pdfStorageRef,
    });

    return this.storage.gerarUrlAssinada(pdfStorageRef);
  }

  /** Código oficial do SERPRO pra "esta data ainda não tem Taxa Selic publicada" (confirmado contra produção em 2026-10-21). */
  private extrairMensagemSelicAusente(corpo: unknown): boolean {
    const mensagens = (corpo as { mensagens?: Array<{ codigo?: string }> } | null)?.mensagens;
    return Array.isArray(mensagens) && mensagens.some((m) => m.codigo?.includes('MSG_ISN_004'));
  }

  /**
   * CONFIRMADO contra o SERPRO de produção em 2026-10-21 -- a doc oficial erra em DOIS
   * pontos: (1) `dados` é um ARRAY `[{...}]`, não um objeto direto -- pega sempre o
   * primeiro item; (2) o campo chama `detalhamentoDas`, não `detalhamento` como a doc
   * descreve. `dados.pdf` + `dados[0].detalhamentoDas.{dataVencimento,valores.total}`.
   */
  private extrairGerarDas(corpo: unknown): { pdfBase64: string | null; vencimento: string | null; valorTotal: number | null } | null {
    try {
      const corpoObj = corpo as { dados?: string };
      if (!corpoObj?.dados) return null;
      const parsed = JSON.parse(corpoObj.dados) as Array<{
        pdf?: string;
        detalhamentoDas?: { dataVencimento?: string; valores?: { total?: number } };
      }>;
      const item = Array.isArray(parsed) ? parsed[0] : undefined;
      if (!item) return null;

      const dataVencimento = item.detalhamentoDas?.dataVencimento ?? null;
      const vencimento = dataVencimento && dataVencimento.length === 8
        ? `${dataVencimento.slice(0, 4)}-${dataVencimento.slice(4, 6)}-${dataVencimento.slice(6, 8)}`
        : null;
      return {
        pdfBase64: item.pdf ?? null,
        vencimento,
        valorTotal: item.detalhamentoDas?.valores?.total ?? null,
      };
    } catch {
      return null;
    }
  }
}
