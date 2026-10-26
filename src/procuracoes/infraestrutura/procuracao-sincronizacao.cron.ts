import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../empresas/aplicacao/portas/empresas-repositorio.port';
import { SincronizarProcuracaoUseCase } from '../aplicacao/casos-de-uso/sincronizar-procuracao.usecase';

/**
 * Sync diário de procuração (Modo A) -- mesmo horário/raciocínio de DasSincronizacaoCron
 * (madrugada, menor uso da API do SERPRO). Uma empresa falhando nunca aborta o lote.
 */
@Injectable()
export class ProcuracaoSincronizacaoCron {
  private readonly logger = new Logger(ProcuracaoSincronizacaoCron.name);

  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly sincronizarProcuracao: SincronizarProcuracaoUseCase,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async executar(): Promise<void> {
    const empresas = await this.empresasRepositorio.listarAtivasComProcuracao();

    let processadas = 0;
    let comErro = 0;

    for (const empresa of empresas) {
      try {
        await this.sincronizarProcuracao.executar(empresa.id);
        processadas++;
      } catch (erro) {
        comErro++;
        this.logger.warn(`Falha ao sincronizar procuração da empresa ${empresa.id}: ${(erro as Error).message}`);
      }
    }

    this.logger.log(`Sincronização diária de procuração: ${processadas} empresa(s) processada(s), ${comErro} com erro.`);
  }
}
