import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { classificarDirecaoServico } from '../../dominio/classificar-direcao-servico';
import { parseXmlNfse } from '../../dominio/parser-xml-nfse';
import { StorageNotasServicoService } from '../../infraestrutura/storage-notas-servico.service';
import { NOTAS_SERVICO_REPOSITORIO, NotasServicoRepositorioPort } from '../portas/notas-servico-repositorio.port';

export interface ResultadoIngestaoNotaServico {
  notaId: string;
  /** true = XML já tinha sido ingerido antes (mesma chave de acesso) -- agente pode reenviar sem medo, nunca duplica. */
  duplicada: boolean;
}

/**
 * Fase 1 (ingestão) -- parse -> dedupe por chave de acesso -> direção (entrada/saída, por
 * CNPJ/CPF prestador/tomador) -> grava XML cru no storage -> persiste como 'capturada'.
 * Diferente de IngerirNotaFiscalUseCase: NÃO resolve fornecedor/cliente ainda (Fase 2, junto
 * com o lançamento contábil) e NÃO filtra por "situação autorizada" (NFS-e não tem conceito
 * de cStat -- toda NFS-e processada pelo Ambiente de Dados Nacional já é válida por
 * definição; `situacao` só diferencia válida/substituída/cancelada posteriormente).
 */
@Injectable()
export class IngerirNotaServicoUseCase {
  constructor(
    @Inject(NOTAS_SERVICO_REPOSITORIO) private readonly notasServicoRepositorio: NotasServicoRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    private readonly storage: StorageNotasServicoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(empresaId: string, xmlBruto: string): Promise<ResultadoIngestaoNotaServico> {
    const extraida = parseXmlNfse(xmlBruto);

    const existente = await this.notasServicoRepositorio.buscarPorChave(empresaId, extraida.chaveAcesso);
    if (existente) {
      return { notaId: existente.id, duplicada: true };
    }

    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');

    // empresa.cnpj guarda CPF quando a empresa interna é pessoa física (tipo=interna_contador) -- mesma coluna, sem campo separado.
    const direcao = classificarDirecaoServico(empresa.cnpj, extraida.emitenteCnpj, extraida.emitenteCpf, extraida.tomadorCnpj, extraida.tomadorCpf);

    const xmlStorageRef = await this.storage.armazenar(empresaId, xmlBruto);
    const notaId = await this.notasServicoRepositorio.criar({ empresaId, extraida, direcao, xmlStorageRef });

    await this.auditoria.registrar({
      usuarioId: null,
      empresaId,
      acao: 'INGERIR_NOTA_SERVICO',
      recurso: `notas_servico:${notaId}`,
      dadosNovos: { chaveAcesso: extraida.chaveAcesso, direcao, situacao: extraida.situacao, valorLiquido: extraida.valorLiquido },
    });

    return { notaId, duplicada: false };
  }
}
