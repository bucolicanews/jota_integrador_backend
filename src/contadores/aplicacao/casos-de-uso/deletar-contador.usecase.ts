import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CONTADORES_REPOSITORIO, ContadoresRepositorioPort } from '../portas/contadores-repositorio.port';

/**
 * Excluir um contador é definitivo (ao contrário de bloquear/desbloquear, que é
 * reversível) -- só permitido quando ele não tem NENHUM rastro de uso real: carteira
 * vazia, sem login, sem assinatura/licença/crédito/consulta, sem contabilidade própria.
 * Existe pra corrigir cadastro feito errado (ex: duplicado por engano), não pra "desligar"
 * um contador que já operou -- isso continua sendo BloquearContadorUseCase.
 */
@Injectable()
export class DeletarContadorUseCase {
  constructor(
    @Inject(CONTADORES_REPOSITORIO) private readonly contadoresRepositorio: ContadoresRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(id: string, executadoPorId: string): Promise<void> {
    const contador = await this.contadoresRepositorio.buscarPorId(id);
    if (!contador) {
      throw new NotFoundException('Contador não encontrado');
    }
    if (contador.tipo !== 'humano') {
      throw new ConflictException('Este contador é uma entidade interna do sistema -- não pode ser excluído');
    }

    const impedimentos = await this.contadoresRepositorio.verificarImpedimentosExclusao(id);
    if (impedimentos.length > 0) {
      throw new ConflictException(`Não é possível excluir -- ${impedimentos.join('; ')}`);
    }

    await this.contadoresRepositorio.remover(id);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      contadorId: null, // contador já não existe mais -- nunca referenciar um id apagado
      acao: 'contador.excluir',
      recurso: 'contadores',
      dadosAntigos: { id: contador.id, nome: contador.nome, cnpjCpf: contador.cnpjCpf, email: contador.email },
    });
  }
}
