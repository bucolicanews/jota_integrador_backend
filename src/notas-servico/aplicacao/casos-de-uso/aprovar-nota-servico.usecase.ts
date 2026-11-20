import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { NOTAS_SERVICO_REPOSITORIO, NotasServicoRepositorioPort } from '../portas/notas-servico-repositorio.port';

/**
 * Fase 1 -- só marca status='aprovada'. NUNCA cria fornecedor/cliente nem lançamento
 * contábil ainda (isso é Fase 2, mesmo princípio de AprovarNotaFiscalUseCase pra NFe/NFCe,
 * que também só age depois de revisão humana explícita).
 */
@Injectable()
export class AprovarNotaServicoUseCase {
  constructor(
    @Inject(NOTAS_SERVICO_REPOSITORIO) private readonly notasServicoRepositorio: NotasServicoRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, aprovadoPor: string): Promise<void> {
    const nota = await this.notasServicoRepositorio.obterDetalhe(id, empresaId);
    if (!nota) throw new NotFoundException('NFS-e não encontrada');
    if (nota.status !== 'capturada') throw new BadRequestException('Só é possível aprovar NFS-e com status "capturada"');

    await this.notasServicoRepositorio.marcarAprovada(id, aprovadoPor);

    await this.auditoria.registrar({
      usuarioId: aprovadoPor,
      empresaId,
      acao: 'APROVAR_NOTA_SERVICO',
      recurso: `notas_servico:${id}`,
      dadosNovos: { chaveAcesso: nota.chaveAcesso },
    });
  }
}
