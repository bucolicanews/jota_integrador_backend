import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { DAS_REPOSITORIO, DasRepositorioPort } from '../portas/das-repositorio.port';
import { GerarProvisaoDasUseCase, MotivoProvisaoNaoGerada } from './gerar-provisao-das.usecase';

const MENSAGENS: Record<MotivoProvisaoNaoGerada, string> = {
  'ja-existe': 'Este DAS já tem conta a pagar de provisão.',
  'sem-valor': 'Este DAS não tem valor estruturado -- lance manualmente.',
  pago: 'Este DAS já está pago -- use a baixa, não a provisão.',
  'sem-configuracao': 'Configure as contas de lançamento do DAS antes (botão "Configurar contas do lançamento automático").',
};

/** Gatilho manual pro contador/empresário gerar a provisão de um DAS que ficou sem conta a pagar (geralmente porque a config não existia na hora do sync) -- nunca chama SERPRO, zero crédito gasto. */
@Injectable()
export class GerarProvisaoManualDasUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(DAS_REPOSITORIO) private readonly dasRepositorio: DasRepositorioPort,
    private readonly gerarProvisaoDas: GerarProvisaoDasUseCase,
  ) {}

  async executar(empresaId: string, dasId: string): Promise<{ contaPagarId: string }> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new ForbiddenException('Empresa não encontrada');
    }
    if (empresa.regimeTributario !== 'mei' && empresa.regimeTributario !== 'simples_nacional') {
      throw new BadRequestException('Módulo de DAS só se aplica a empresas MEI ou Simples Nacional ME/EPP');
    }

    const item = await this.dasRepositorio.buscarPorId(dasId, empresa.regimeTributario);
    if (!item || item.empresaId !== empresaId) {
      throw new NotFoundException('DAS não encontrado');
    }

    const resultado = await this.gerarProvisaoDas.executar(empresaId, item);
    if (!resultado.gerado || !resultado.contaPagarId) {
      throw new BadRequestException(MENSAGENS[resultado.motivo ?? 'sem-configuracao']);
    }
    return { contaPagarId: resultado.contaPagarId };
  }
}
