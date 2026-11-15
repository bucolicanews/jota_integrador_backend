import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { CriarClienteUseCase } from '../../../clientes/aplicacao/casos-de-uso/criar-cliente.usecase';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { CriarFornecedorUseCase } from '../../../fornecedores/aplicacao/casos-de-uso/criar-fornecedor.usecase';
import { FORNECEDORES_REPOSITORIO, FornecedoresRepositorioPort } from '../../../fornecedores/aplicacao/portas/fornecedores-repositorio.port';
import { classificarDirecao } from '../../dominio/classificar-direcao';
import { C_STAT_AUTORIZADA } from '../../dominio/nota-fiscal';
import { parseXmlNfe } from '../../dominio/parser-xml-nfe';
import { NOTAS_FISCAIS_REPOSITORIO, NotasFiscaisRepositorioPort } from '../portas/notas-fiscais-repositorio.port';
import { StorageNotasFiscaisService } from '../../infraestrutura/storage-notas-fiscais.service';

export interface ResultadoIngestaoNotaFiscal {
  notaId: string;
  /** true = XML já tinha sido ingerido antes (mesma chave de acesso) -- agente pode reenviar sem medo, nunca duplica. */
  duplicada: boolean;
}

/**
 * Núcleo da captura automática: parse -> dedupe por chave de acesso -> direção
 * (entrada/saída, por CNPJ) -> dedupe/cria fornecedor ou cliente -> grava XML cru no
 * storage -> persiste nota+itens+parcelas como 'capturada'. NUNCA cria conta a
 * pagar/receber nem lançamento contábil aqui -- isso só acontece em
 * AprovarNotaFiscalUseCase, depois de revisão humana.
 */
@Injectable()
export class IngerirNotaFiscalUseCase {
  constructor(
    @Inject(NOTAS_FISCAIS_REPOSITORIO) private readonly notasFiscaisRepositorio: NotasFiscaisRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(FORNECEDORES_REPOSITORIO) private readonly fornecedoresRepositorio: FornecedoresRepositorioPort,
    @Inject(CLIENTES_REPOSITORIO) private readonly clientesRepositorio: ClientesRepositorioPort,
    private readonly criarFornecedor: CriarFornecedorUseCase,
    private readonly criarCliente: CriarClienteUseCase,
    private readonly storage: StorageNotasFiscaisService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(empresaId: string, xmlBruto: string): Promise<ResultadoIngestaoNotaFiscal> {
    const extraida = parseXmlNfe(xmlBruto);

    const existente = await this.notasFiscaisRepositorio.buscarPorChave(empresaId, extraida.chaveAcesso);
    if (existente) {
      return { notaId: existente.id, duplicada: true };
    }

    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');

    const direcao = classificarDirecao(empresa.cnpj, extraida.emitenteCnpj, extraida.destinatarioDocumento);

    // Nota não autorizada (cStat != 100, ou sem protocolo) nunca gera fornecedor/cliente --
    // fica fora da fila normal de aprovação (ListarNotasFiscaisPendentesUseCase filtra por
    // status='capturada' + cStat é mostrado na tela pra quem revisa decidir o que fazer).
    let fornecedorId: string | null = null;
    let clienteId: string | null = null;
    if (extraida.cStat === C_STAT_AUTORIZADA) {
      if (direcao === 'entrada') {
        fornecedorId = await this.resolverFornecedor(empresaId, extraida.emitenteCnpj, extraida.emitenteNome);
      } else if (extraida.destinatarioDocumento) {
        // NFCe de consumidor final não identificado não força cadastro de cliente.
        clienteId = await this.resolverCliente(empresaId, extraida.destinatarioDocumento, extraida.destinatarioNome ?? 'Consumidor');
      }
    }

    const xmlStorageRef = await this.storage.armazenar(empresaId, xmlBruto);
    const notaId = await this.notasFiscaisRepositorio.criar({ empresaId, extraida, direcao, xmlStorageRef, fornecedorId, clienteId });

    await this.auditoria.registrar({
      usuarioId: null,
      empresaId,
      acao: 'INGERIR_NOTA_FISCAL',
      recurso: `notas_fiscais:${notaId}`,
      dadosNovos: { chaveAcesso: extraida.chaveAcesso, direcao, cStat: extraida.cStat, valorTotal: extraida.valorTotal },
    });

    return { notaId, duplicada: false };
  }

  private async resolverFornecedor(empresaId: string, documento: string, nome: string): Promise<string> {
    const existente = await this.fornecedoresRepositorio.buscarPorDocumento(empresaId, documento);
    if (existente) return existente.id;
    const criado = await this.criarFornecedor.executar({ empresaId, nome, documento });
    return criado.id;
  }

  private async resolverCliente(empresaId: string, documento: string, nome: string): Promise<string> {
    const existente = await this.clientesRepositorio.buscarPorDocumento(empresaId, documento);
    if (existente) return existente.id;
    const criado = await this.criarCliente.executar({ empresaId, nome, documento });
    return criado.id;
  }
}
