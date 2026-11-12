import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { BANCOS_REPOSITORIO, BancosRepositorioPort, TipoBanco } from '../../../bancos/aplicacao/portas/bancos-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';

export interface DadosResolverBaixaDas {
  empresaId: string;
  dasId: string;
  /** 'caixa'/'banco' -- precisa bater com o tipo cadastrado do banco escolhido (validado abaixo), nunca inferido. */
  tipo: Exclude<TipoBanco, 'outra'>;
  bancoId: string;
  resolvidoPor: string;
}

/**
 * Baixa (quitação) do DAS -- nunca automática (ver comentário da migration
 * 20261110000001): o contador escolhe caixa ou banco na hora, porque só ele sabe de onde
 * saiu o dinheiro. Se banco, o lançamento nasce `pendente_conciliacao=true` -- vai ser
 * casado depois com o extrato real na conciliação bancária (mecanismo novo, ela hoje só
 * casa transação com PARCELA de contas a pagar/receber, nunca com lançamento direto).
 */
@Injectable()
export class ResolverBaixaDasUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
    @Inject(BANCOS_REPOSITORIO) private readonly bancos: BancosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosResolverBaixaDas): Promise<string> {
    const empresa = await this.empresasRepositorio.buscarPorId(dados.empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }
    if (empresa.regimeTributario !== 'mei' && empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('Módulo de DAS só se aplica a empresas MEI ou Simples Nacional ME/EPP');
    }
    const regime = empresa.regimeTributario;

    const item = await this.dasRepositorio.buscarPorId(dados.dasId, regime);
    if (!item || item.empresaId !== dados.empresaId) {
      throw new NotFoundException('DAS não encontrado');
    }
    if (item.status !== 'pago') {
      throw new BadRequestException('Este DAS ainda não foi confirmado como pago -- sincronize antes de dar baixa');
    }
    if (item.lancamentoBaixaId) {
      throw new BadRequestException('Este DAS já tem baixa registrada');
    }
    if (item.valor === null || item.valor <= 0) {
      throw new BadRequestException('Este DAS não tem valor estruturado -- lance a baixa manualmente');
    }

    const config = await this.dasRepositorio.buscarConfiguracaoLancamentos(dados.empresaId);
    if (!config) {
      throw new BadRequestException('Configure as contas de lançamento do DAS antes de dar baixa (Configurações Fiscais)');
    }

    const banco = await this.bancos.obterPorId(dados.bancoId);
    if (!banco || banco.empresaId !== dados.empresaId) {
      throw new NotFoundException('Conta de caixa/banco não encontrada');
    }
    if (banco.tipo !== dados.tipo) {
      throw new BadRequestException(`A conta selecionada está cadastrada como "${banco.tipo}", não "${dados.tipo}"`);
    }

    const lancamentoId = await this.lancamentos.criar({
      empresaId: dados.empresaId,
      dataCompetencia: item.pagoEm ? item.pagoEm.slice(0, 10) : new Date().toISOString().slice(0, 10),
      historico: `Baixa DAS -- competência ${item.competencia.slice(0, 7)}`,
      documentoReferencia: item.id,
      origem: 'das',
      partidas: [
        { contaId: config.contaCreditoId, tipo: 'debito', valor: item.valor },
        { contaId: banco.contaContabilId, tipo: 'credito', valor: item.valor },
      ],
      criadoPor: dados.resolvidoPor,
    });

    if (dados.tipo === 'banco') {
      await this.lancamentos.marcarPendenteConciliacao(lancamentoId);
    }

    await this.dasRepositorio.marcarLancamentoBaixa(item.id, regime, lancamentoId);

    await this.auditoria.registrar({
      usuarioId: dados.resolvidoPor,
      empresaId: dados.empresaId,
      acao: 'RESOLVER_BAIXA_DAS',
      recurso: `lancamentos_contabeis:${lancamentoId}`,
      dadosNovos: { dasId: item.id, tipo: dados.tipo, bancoId: dados.bancoId },
    });

    return lancamentoId;
  }
}
