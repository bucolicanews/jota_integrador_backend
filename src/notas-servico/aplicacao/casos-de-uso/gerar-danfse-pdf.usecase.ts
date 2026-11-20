import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GeradorDanfseClient, OpcoesGerarDanfse } from '../../infraestrutura/gerador-danfse.client';
import { StorageNotasServicoService } from '../../infraestrutura/storage-notas-servico.service';
import { NOTAS_SERVICO_REPOSITORIO, NotasServicoRepositorioPort } from '../portas/notas-servico-repositorio.port';

/**
 * Fase 3 -- gera o PDF (DANFSe) a partir do XML de uma NFS-e já ingerida (Fase 1). Não exige
 * status='aprovada': visualizar o DANFSe é consulta, não ação de aprovação -- mesmo
 * princípio de ObterUrlXmlNotaFiscalUseCase (XML disponível pra qualquer nota existente,
 * independente do status).
 */
@Injectable()
export class GerarDanfsePdfUseCase {
  constructor(
    @Inject(NOTAS_SERVICO_REPOSITORIO) private readonly notasServicoRepositorio: NotasServicoRepositorioPort,
    private readonly storage: StorageNotasServicoService,
    private readonly geradorDanfse: GeradorDanfseClient,
  ) {}

  async executar(id: string, empresaId: string, opcoes?: OpcoesGerarDanfse): Promise<Buffer> {
    const nota = await this.notasServicoRepositorio.obterDetalhe(id, empresaId);
    if (!nota) throw new NotFoundException('NFS-e não encontrada');

    const xmlNfse = await this.storage.baixar(nota.xmlStorageRef);
    return this.geradorDanfse.gerar(xmlNfse, opcoes);
  }
}
