import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { PLANOS_REPOSITORIO, PlanosRepositorioPort } from '../../../planos/aplicacao/portas/planos-repositorio.port';
import { planoExpirado } from '../../../planos/dominio/plano';
import { ASSINATURAS_REPOSITORIO, Assinatura, AssinaturasRepositorioPort } from '../portas/assinaturas-repositorio.port';

export interface DadosAtivarAssinaturaManual {
  contadorId: string;
  empresaId: string;
  planoId: string;
  planoRevendaId: string | null;
}

/**
 * Contador inclui/edita/reativa manualmente o plano de créditos de uma empresa da
 * própria carteira, SEM cobrar via PagBank -- mesma separação "manual grátis vs. split
 * pago" de AtivarLicencaUseCase/IniciarPagamentoAtivacaoLicencaUseCase. Se o contador só
 * quer bloquear/desbloquear sem mexer no plano, use BloquearAssinaturaUseCase.
 */
@Injectable()
export class AtivarAssinaturaManualUseCase {
  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly repositorio: AssinaturasRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(PLANOS_REPOSITORIO) private readonly planosRepositorio: PlanosRepositorioPort,
  ) {}

  async executar(dados: DadosAtivarAssinaturaManual): Promise<Assinatura> {
    const pertence = await this.empresasRepositorio.pertenceAoContador(dados.empresaId, dados.contadorId);
    if (!pertence) {
      throw new NotFoundException('Empresa não encontrada na sua carteira');
    }

    const plano = await this.planosRepositorio.buscarPorId(dados.planoId);
    if (!plano || !plano.ativo) {
      throw new NotFoundException('Plano não encontrado ou não está mais disponível');
    }
    if (planoExpirado(plano.dataValidade)) {
      throw new BadRequestException('Plano expirado -- não é possível ativar');
    }

    const atual = await this.repositorio.buscarPorEmpresa(dados.empresaId);
    let assinatura: Assinatura;
    if (atual) {
      await this.repositorio.atualizar(atual.id, { planoId: dados.planoId, planoRevendaId: dados.planoRevendaId });
      if (atual.status !== 'ativa') {
        await this.repositorio.atualizarStatus(atual.id, 'ativa');
      }
      assinatura = { ...atual, planoId: dados.planoId, planoRevendaId: dados.planoRevendaId, status: 'ativa' };
    } else {
      assinatura = await this.repositorio.criar({
        contadorId: dados.contadorId,
        empresaId: dados.empresaId,
        planoId: dados.planoId,
        planoRevendaId: dados.planoRevendaId,
      });
    }

    return assinatura;
  }
}
