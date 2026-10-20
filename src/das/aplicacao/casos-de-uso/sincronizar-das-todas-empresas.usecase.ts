import { Inject, Injectable, Logger } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { SincronizarDasEmpresaUseCase } from './sincronizar-das-empresa.usecase';

/**
 * Chamado pelo cron (`DasSincronizacaoCron`). Itera TODAS as empresas-cliente ativas
 * com regime MEI/Simples Nacional -- uma empresa falhando (procuração expirada, saldo
 * insuficiente, SERPRO fora do ar) nunca aborta o lote inteiro, só pula pra próxima
 * (mesmo cuidado de isolamento já documentado nos use cases individuais do SERPRO).
 */
@Injectable()
export class SincronizarDasTodasEmpresasUseCase {
  private readonly logger = new Logger(SincronizarDasTodasEmpresasUseCase.name);

  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly sincronizarDasEmpresa: SincronizarDasEmpresaUseCase,
  ) {}

  async executar(): Promise<{ empresasProcessadas: number; empresasComErro: number }> {
    const empresas = await this.empresasRepositorio.listarAtivasPorRegime(['mei', 'simples_nacional']);

    let empresasProcessadas = 0;
    let empresasComErro = 0;

    for (const empresa of empresas) {
      try {
        await this.sincronizarDasEmpresa.executar(empresa.id);
        empresasProcessadas++;
      } catch (erro) {
        empresasComErro++;
        this.logger.warn(`Falha ao sincronizar DAS da empresa ${empresa.id}: ${(erro as Error).message}`);
      }
    }

    return { empresasProcessadas, empresasComErro };
  }
}
