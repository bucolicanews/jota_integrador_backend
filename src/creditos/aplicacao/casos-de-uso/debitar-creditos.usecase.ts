import { Inject, Injectable } from '@nestjs/common';
import { custoDaOperacao } from '../../dominio/credito';
import { CREDITOS_REPOSITORIO, CreditosRepositorioPort } from '../portas/creditos-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';

/** Saldo sentinela devolvido quando o débito é pulado (empresa interna_plataforma) -- nenhum chamador usa o valor de retorno, só o `await`. */
const SALDO_ILIMITADO = Number.POSITIVE_INFINITY;

/**
 * Caso de uso reutilizável por outros módulos (ex: serpro/) antes de gastar uma
 * operação paga -- nunca reimplementar a lógica de débito em outro lugar, sempre
 * passar por aqui pra garantir que o custo vem do catálogo único (docs/creditos/dominio).
 */
@Injectable()
export class DebitarCreditosUseCase {
  constructor(
    @Inject(CREDITOS_REPOSITORIO) private readonly creditosRepositorio: CreditosRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
  ) {}

  /**
   * Retorna o novo saldo. Lança SaldoInsuficienteError (docs/creditos-repositorio.port) se não
   * houver crédito suficiente. A empresa interna_plataforma (workspace do admin/Jota) nunca tem
   * creditos_saldo provisionado -- de propósito, ela nunca é cliente -- então crédito pra ela é
   * sempre ilimitado, nunca passa pelo gate de saldo.
   */
  async executar(contadorId: string, empresaId: string, tipoOperacao: string, motivo: string): Promise<number> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (empresa?.tipo === 'interna_plataforma') {
      return SALDO_ILIMITADO;
    }

    const quantidade = custoDaOperacao(tipoOperacao);
    return this.creditosRepositorio.debitar(contadorId, empresaId, tipoOperacao, quantidade, motivo);
  }
}
