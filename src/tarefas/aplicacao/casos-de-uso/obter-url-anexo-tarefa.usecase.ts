import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StorageTarefasAnexosService } from '../../infraestrutura/storage-tarefas-anexos.service';
import { TAREFAS_REPOSITORIO, TarefasRepositorioPort } from '../portas/tarefas-repositorio.port';

export interface UrlAnexoTarefa {
  url: string;
  expiraEmSegundos: number;
}

@Injectable()
export class ObterUrlAnexoTarefaUseCase {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly repositorio: TarefasRepositorioPort,
    private readonly storage: StorageTarefasAnexosService,
  ) {}

  async executar(tarefaId: string, anexoId: string, empresaId: string): Promise<UrlAnexoTarefa> {
    const tarefa = await this.repositorio.obterPorId(tarefaId);
    if (!tarefa || tarefa.empresaId !== empresaId) {
      throw new NotFoundException('Tarefa não encontrada');
    }
    const anexo = await this.repositorio.obterAnexo(anexoId);
    if (!anexo || anexo.tarefaId !== tarefaId) {
      throw new NotFoundException('Anexo não encontrado');
    }
    return this.storage.gerarUrlAssinada(anexo.storageRef);
  }
}
