import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CONTAS_RECEBER_REPOSITORIO, ContasReceberRepositorioPort } from '../portas/contas-receber-repositorio.port';

@Injectable()
export class CancelarContaReceberUseCase {
  constructor(
    @Inject(CONTAS_RECEBER_REPOSITORIO) private readonly repositorio: ContasReceberRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, empresaId: string, usuarioId: string): Promise<void> {
    const conta = await this.repositorio.obterPorId(id);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta a receber não encontrada');
    }
    if (conta.valorRecebido > 0) {
      throw new BadRequestException('Conta já tem recebimento registrado -- estorne o(s) recebimento(s) antes de cancelar');
    }

    await this.repositorio.cancelar(id);

    await this.auditoria.registrar({
      usuarioId,
      empresaId,
      acao: 'CANCELAR_CONTA_RECEBER',
      recurso: `contas_receber:${id}`,
      dadosAntigos: { clienteNome: conta.clienteNome, valorTotal: conta.valorTotal },
    });
  }
}
