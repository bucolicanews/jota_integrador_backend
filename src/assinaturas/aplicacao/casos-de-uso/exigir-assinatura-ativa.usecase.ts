import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  EMPRESAS_REPOSITORIO,
  EmpresasRepositorioPort,
} from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  ASSINATURAS_REPOSITORIO,
  AssinaturasRepositorioPort,
} from '../portas/assinaturas-repositorio.port';

/**
 * Gate de créditos por empresa, usado antes de qualquer consumo de SERPRO (DAS, Caixa
 * Postal, CCMEI) -- extraído do que antes era checagem duplicada em 6 usecases
 * diferentes, pra corrigir num lugar só um bug real: a empresa interna_plataforma
 * (workspace fixo do admin/Jota) nunca "compra" plano de si mesma -- mesma exceção já
 * feita em DebitarCreditosUseCase (saldo ilimitado pra ela), só que faltava aqui, no
 * gate que roda ANTES do débito. interna_contador segue exigindo assinatura normal --
 * o escritório do contador é tratado como "cliente de si mesmo" de propósito, só a
 * plataforma (que absorve o custo real do SERPRO) é isenta.
 */
@Injectable()
export class ExigirAssinaturaAtivaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(ASSINATURAS_REPOSITORIO) private readonly assinaturasRepositorio: AssinaturasRepositorioPort,
  ) {}

  /** Devolve o planoId da assinatura ativa (null se interna_plataforma, isenta de plano). */
  async executar(empresaId: string): Promise<string | null> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (empresa?.tipo === 'interna_plataforma') return null;

    const assinatura = await this.assinaturasRepositorio.buscarAtivaPorEmpresa(empresaId);
    if (!assinatura) {
      throw new ForbiddenException('Empresa sem plano de créditos ativo -- contate seu contador');
    }
    return assinatura.planoId;
  }
}
