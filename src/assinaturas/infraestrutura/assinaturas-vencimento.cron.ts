import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ASSINATURAS_REPOSITORIO, AssinaturasRepositorioPort } from '../aplicacao/portas/assinaturas-repositorio.port';

/**
 * Marca como 'vencida' toda assinatura 'ativa' cujo fim_em já passou -- sem isso o
 * `status` cru ficava mentindo "ativa" pra sempre (bug real reportado 2026-10-26).
 * De hora em hora (não diário como DasSincronizacaoCron) -- é gate de acesso/billing,
 * atraso de 1 dia seria inaceitável; o gate real (buscarAtivaPorEmpresa/SQL) já checa
 * fim_em em tempo real de qualquer forma, isso aqui só deixa o campo status coerente
 * pras telas que o leem direto (ex: badge de status na Carteira de Empresas).
 */
@Injectable()
export class AssinaturasVencimentoCron {
  private readonly logger = new Logger(AssinaturasVencimentoCron.name);

  constructor(@Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort) {}

  @Cron(CronExpression.EVERY_HOUR)
  async executar(): Promise<void> {
    const quantidade = await this.assinaturasRepositorio.marcarVencidas();
    if (quantidade > 0) {
      this.logger.log(`${quantidade} assinatura(s) marcada(s) como vencida(s).`);
    }
  }
}
