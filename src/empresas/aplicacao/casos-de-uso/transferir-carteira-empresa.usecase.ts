import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../portas/empresas-repositorio.port';

/**
 * Move uma empresa pra outra carteira (muda `contador_id`) -- ação admin-only (checado
 * no controller), rara e sensível: o contador antigo perde acesso à empresa
 * imediatamente (RLS lê `contador_id` ao vivo, nunca cacheado) e o novo ganha. Honorários/
 * licenças futuros passam a ser do novo contador; histórico de auditoria/consultas
 * anteriores à transferência permanece como estava (nunca reescrito).
 */
@Injectable()
export class TransferirCarteiraEmpresaUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(empresaId: string, novoContadorId: string, executadoPorId: string): Promise<void> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const contadorAntigo = empresa.contadorId;
    if (contadorAntigo === novoContadorId) {
      return; // já é desse contador, nada a fazer -- evita log de auditoria vazio
    }

    await this.empresasRepositorio.atualizarContadorId(empresaId, novoContadorId);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      empresaId,
      contadorId: novoContadorId,
      acao: 'empresa.transferir_carteira',
      recurso: 'empresas',
      dadosAntigos: { contadorId: contadorAntigo },
      dadosNovos: { contadorId: novoContadorId },
    });
  }
}
