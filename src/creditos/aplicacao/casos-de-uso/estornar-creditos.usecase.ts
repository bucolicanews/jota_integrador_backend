import { Inject, Injectable } from '@nestjs/common';
import { CREDITOS_REPOSITORIO, CreditosRepositorioPort } from '../portas/creditos-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';

/**
 * Compensação (padrão saga, docs/SEGURANCA.md §6) para quando o débito teve sucesso
 * mas a operação paga (ex: chamada ao SERPRO) falhou depois -- nunca deixar o cliente
 * pagando por algo que não aconteceu. Não existe transação distribuída real entre
 * nosso banco e o SERPRO, então o estorno é a forma de manter os dois sincronizados.
 */
@Injectable()
export class EstornarCreditosUseCase {
  constructor(
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  /** Empresa interna_plataforma nunca debita (DebitarCreditosUseCase) -- estornar aqui pra ela criaria saldo fantasma, então também pula. */
  async executar(contadorId: string, empresaId: string, quantidade: number, motivo: string): Promise<number> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (empresa?.tipo === 'interna_plataforma') {
      return Number.POSITIVE_INFINITY;
    }

    return this.creditosRepositorio.creditar(contadorId, empresaId, quantidade, `ESTORNO: ${motivo}`);
  }
}
