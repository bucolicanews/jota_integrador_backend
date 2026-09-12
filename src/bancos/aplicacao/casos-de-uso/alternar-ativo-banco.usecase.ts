import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { BANCOS_REPOSITORIO, BancosRepositorioPort } from '../portas/bancos-repositorio.port';

@Injectable()
export class AlternarAtivoBancoUseCase {
  constructor(
    @Inject(BANCOS_REPOSITORIO) private readonly repositorio: BancosRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, ativo: boolean, usuarioId: string): Promise<void> {
    const banco = await this.repositorio.obterPorId(id);
    if (!banco || banco.empresaId !== empresaId) {
      throw new NotFoundException('Banco não encontrado');
    }
    await this.repositorio.marcarAtivo(id, ativo);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: ativo ? 'REATIVAR_BANCO' : 'DESATIVAR_BANCO',
      recurso: `bancos:${id}`,
    });
  }
}
