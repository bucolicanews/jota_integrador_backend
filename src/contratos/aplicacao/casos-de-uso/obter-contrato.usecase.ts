import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { CONTRATOS_REPOSITORIO, ContratoAditivo, ContratoGerado, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

export interface ContratoComAditivos extends ContratoGerado {
  aditivos: ContratoAditivo[];
  /** Calculado -- true quando o contrato não tem valor financeiro (nada a lançar), ou o lançamento de competência (contaReceberId/contaPagarId) ainda está ativo. false = foi estornado e nada o substituiu (ver botão "Realizar lançamento novamente" no frontend). */
  temLancamentoAtivo: boolean;
}

@Injectable()
export class ObterContratoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
  ) {}

  async executar(id: string, empresaId: string): Promise<ContratoComAditivos> {
    const contrato = await this.repositorio.obterContratoPorId(id);
    if (!contrato || contrato.empresaId !== empresaId) {
      throw new NotFoundException('Contrato não encontrado');
    }
    const aditivos = await this.repositorio.listarAditivosPorContrato(id);

    const documentoFinanceiro = contrato.contaReceberId ?? contrato.contaPagarId;
    const temLancamentoAtivo = documentoFinanceiro
      ? await this.lancamentos.existeLancamentoAtivoParaDocumento(documentoFinanceiro)
      : true;

    return { ...contrato, aditivos, temLancamentoAtivo };
  }
}
