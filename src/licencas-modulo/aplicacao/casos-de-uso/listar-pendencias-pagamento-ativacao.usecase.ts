import { Inject, Injectable } from '@nestjs/common';
import {
  PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO,
  PagamentoAtivacaoLicenca,
  PagamentosAtivacaoLicencaRepositorioPort,
} from '../portas/pagamentos-ativacao-licenca-repositorio.port';

/** Tela "Pendências de ativação de módulo" (lado JOTA FISCAL) -- a empresa paga o PIX direto ali, sem depender do contador repassar o código por fora. */
@Injectable()
export class ListarPendenciasPagamentoAtivacaoUseCase {
  constructor(
    @Inject(PAGAMENTOS_ATIVACAO_LICENCA_REPOSITORIO) private readonly repositorio: PagamentosAtivacaoLicencaRepositorioPort,
  ) {}

  async executar(empresaId: string): Promise<PagamentoAtivacaoLicenca[]> {
    return this.repositorio.listarPendentesPorEmpresa(empresaId);
  }
}
