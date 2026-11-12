import { Inject, Injectable } from '@nestjs/common';
import { UsuarioSistemaService } from '../../../common/usuario-sistema/usuario-sistema.service';
import { CriarContaPagarUseCase } from '../../../contas-a-pagar/aplicacao/casos-de-uso/criar-conta-pagar.usecase';
import { DasItem, statusApresentacao } from '../../dominio/das';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';

export type MotivoProvisaoNaoGerada = 'ja-existe' | 'sem-valor' | 'pago' | 'sem-configuracao';

export interface ResultadoGerarProvisao {
  gerado: boolean;
  motivo?: MotivoProvisaoNaoGerada;
  contaPagarId?: string;
}

const FORNECEDOR_DAS = 'Receita Federal -- Simples Nacional/MEI (DAS)';

/**
 * Núcleo da provisão automática do DAS -- decisão do usuário (sessão 2026-11-11): não é
 * mais um lançamento direto, é uma CONTA A PAGAR de verdade (fornecedor é texto livre,
 * sem precisar cadastro), reaproveitando CriarContaPagarUseCase, que já cria
 * conta+parcela+lançamento junto (Débito despesa / Crédito passivo "DAS a pagar", contas
 * de das_configuracoes_lancamentos). Usado tanto pelo sync (passagem silenciosa, nunca
 * lança exceção) quanto pelo endpoint manual (usuário clica "Gerar lançamento" num DAS
 * que ficou sem provisão porque a config ainda não existia na hora do sync -- ver
 * GerarProvisaoManualDasUseCase). Nunca chama SERPRO/débito de crédito -- só grava
 * localmente, por isso pode ser rodado de novo sem custo (idempotente via
 * contaPagarProvisaoId).
 */
@Injectable()
export class GerarProvisaoDasUseCase {
  constructor(
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
    private readonly criarContaPagar: CriarContaPagarUseCase,
    private readonly usuarioSistema: UsuarioSistemaService,
  ) {}

  async executar(empresaId: string, item: DasItem): Promise<ResultadoGerarProvisao> {
    if (item.contaPagarProvisaoId) return { gerado: false, motivo: 'ja-existe' };
    if (item.valor === null || item.valor <= 0) return { gerado: false, motivo: 'sem-valor' };

    const situacao = statusApresentacao(item, new Date());
    if (situacao === 'pago') return { gerado: false, motivo: 'pago' };

    const config = await this.dasRepositorio.buscarConfiguracaoLancamentos(empresaId);
    if (!config) return { gerado: false, motivo: 'sem-configuracao' };

    const criadoPor = await this.usuarioSistema.obterOuCriarId();
    const contaPagarId = await this.criarContaPagar.executar({
      empresaId,
      fornecedorId: null,
      fornecedor: FORNECEDOR_DAS,
      descricao: `DAS -- competência ${item.competencia.slice(0, 7)}`,
      contaResultadoId: config.contaDebitoId,
      contaPatrimonialId: config.contaCreditoId,
      dataEmissao: item.competencia,
      criadoPor,
      modo: 'unico',
      valor: item.valor,
      quantidadeParcelas: 1,
      primeiroVencimento: item.vencimento,
      intervaloDias: 0,
    });
    await this.dasRepositorio.marcarContaPagarProvisao(item.id, item.regime, contaPagarId);
    return { gerado: true, contaPagarId };
  }
}
