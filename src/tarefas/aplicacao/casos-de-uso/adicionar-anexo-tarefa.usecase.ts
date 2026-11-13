import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StorageTarefasAnexosService } from '../../infraestrutura/storage-tarefas-anexos.service';
import { AnexoTarefa, TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

@Injectable()
export class AdicionarAnexoTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
    private readonly storage: StorageTarefasAnexosService,
  ) {}

  async executar(
    tarefaId: string,
    empresaId: string,
    arquivo: { nomeOriginal: string; buffer: Buffer; contentType: string },
    criadoPor: string,
  ): Promise<AnexoTarefa> {
    const tarefa = await this.repositorio.obterPorId(tarefaId);
    if (!tarefa || tarefa.empresaId !== empresaId) {
      throw new NotFoundException('Tarefa não encontrada');
    }

    const ref = await this.storage.armazenar(empresaId, tarefaId, arquivo.nomeOriginal, arquivo.buffer, arquivo.contentType);
    return this.repositorio.adicionarAnexo(tarefaId, arquivo.nomeOriginal, ref, criadoPor);
  }
}
