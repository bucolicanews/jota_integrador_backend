import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SincronizarDasTodasEmpresasUseCase } from '../aplicacao/casos-de-uso/sincronizar-das-todas-empresas.usecase';

/** Primeiro cron do sistema -- decisão do usuário (sync automática, não só botão manual). Diário de madrugada, horário de menor uso da API do SERPRO. */
@Injectable()
export class DasSincronizacaoCron {
  private readonly logger = new Logger(DasSincronizacaoCron.name);

  constructor(private readonly sincronizarTodasEmpresas: SincronizarDasTodasEmpresasUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async executar(): Promise<void> {
    const resultado = await this.sincronizarTodasEmpresas.executar();
    this.logger.log(
      `Sincronização diária de DAS: ${resultado.empresasProcessadas} empresa(s) processada(s), ${resultado.empresasComErro} com erro.`,
    );
  }
}
