import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { ASSINATURAS_REPOSITORIO, Assinatura, AssinaturasRepositorioPort } from '../portas/assinaturas-repositorio.port';

export interface DadosAtualizarVencimentoAssinatura {
  usuarioId: string;
  contadorId: string;
  empresaId: string;
  /** ISO 8601. Null = remove vencimento (volta a não expirar, ex: cortesia). */
  fimEm: string | null;
}

/**
 * Contador ajusta manualmente o "válido até" da assinatura da própria empresa-cliente --
 * cobre o caso que AtivarAssinaturaManualUseCase não seta (ativação sem cobrar nunca grava
 * fim_em) e qualquer correção manual (ex: cortesia extra, erro de ciclo). Mutação
 * financeira sensível -- sempre auditada, mesma regra de SEGURANCA.md.
 */
@Injectable()
export class AtualizarVencimentoAssinaturaUseCase {
  constructor(
    @Inject(ASSINATURAS_REPOSITORIO) private readonly repositorio: AssinaturasRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosAtualizarVencimentoAssinatura): Promise<Assinatura> {
    const pertence = await this.empresasRepositorio.pertenceAoContador(dados.empresaId, dados.contadorId);
    if (!pertence) {
      throw new NotFoundException('Empresa não encontrada na sua carteira');
    }

    const atual = await this.repositorio.buscarPorEmpresa(dados.empresaId);
    if (!atual) {
      throw new NotFoundException('Empresa não tem assinatura -- ative um plano primeiro');
    }

    await this.repositorio.atualizarFimEm(atual.id, dados.fimEm);

    await this.auditoria.registrar({
      usuarioId: dados.usuarioId,
      contadorId: dados.contadorId,
      empresaId: dados.empresaId,
      acao: 'atualizar_vencimento_manual',
      recurso: 'assinaturas',
      dadosAntigos: { fimEm: atual.fimEm },
      dadosNovos: { fimEm: dados.fimEm },
    });

    return { ...atual, fimEm: dados.fimEm };
  }
}
