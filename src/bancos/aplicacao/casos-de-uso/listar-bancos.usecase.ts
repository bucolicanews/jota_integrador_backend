import { Inject, Injectable } from '@nestjs/common';
import { LANCAMENTOS_REPOSITORIO, LancamentosRepositorioPort } from '../../../lancamentos-contabeis/aplicacao/portas/lancamentos-repositorio.port';
import { BANCOS_REPOSITORIO, Banco, BancosRepositorioPort } from '../portas/bancos-repositorio.port';

export interface BancoComSaldo extends Banco {
  saldoAtual: number;
}

/** Saldo sempre calculado ao vivo (nunca cacheado) -- reusa a mesma função `saldo_conta_contabil()` já usada em Relatórios/Fluxo de Caixa, via LancamentosRepositorioPort.obterSaldoConta. */
@Injectable()
export class ListarBancosUseCase {
  constructor(
    @Inject(BANCOS_REPOSITORIO) private readonly repositorio: BancosRepositorioPort,
    @Inject(LANCAMENTOS_REPOSITORIO) private readonly lancamentos: LancamentosRepositorioPort,
  ) {}

  async executar(empresaId: string, apenasAtivos?: boolean): Promise<BancoComSaldo[]> {
    const bancos = await this.repositorio.listarPorEmpresa(empresaId, apenasAtivos);
    return Promise.all(
      bancos.map(async (banco) => ({
        ...banco,
        saldoAtual: await this.lancamentos.obterSaldoConta(banco.contaContabilId),
      })),
    );
  }
}
