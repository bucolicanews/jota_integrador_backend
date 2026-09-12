import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { renderizarTags } from '../../../common/tags/renderizar-tags';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import { CriarContaReceberUseCase } from '../../../contas-a-receber/aplicacao/casos-de-uso/criar-conta-receber.usecase';
import { ModoParcelamento } from '../../../contas-a-receber/dominio/conta-receber';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { resolverTagsAutomaticas } from '../../dominio/contrato';
import { CONTRATOS_REPOSITORIO, ContratoGerado, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

export interface DadosParcelamentoContrato {
  modo: ModoParcelamento;
  quantidadeParcelas: number;
  primeiroVencimento: string;
  intervaloDias: number;
}

export interface DadosCriarContrato {
  empresaId: string;
  modeloId: string;
  clienteId: string;
  titulo: string;
  valoresTagsManuais: Record<string, string>;
  valorTotal: number | null;
  parcelamento: DadosParcelamentoContrato | null; // obrigatório quando valorTotal != null
  criadoPor: string;
}

/**
 * Snapshot imutável: conteudo_renderizado grava o resultado da renderização NESTE
 * momento -- editar modelos_contrato depois não altera nenhum contrato já gerado.
 */
@Injectable()
export class CriarContratoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    @Inject(CLIENTES_REPOSITORIO) private readonly clientes: ClientesRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresas: EmpresasRepositorioPort,
    private readonly criarContaReceber: CriarContaReceberUseCase,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosCriarContrato): Promise<ContratoGerado> {
    const modelo = await this.repositorio.obterModeloPorId(dados.modeloId);
    if (!modelo || modelo.empresaId !== dados.empresaId) {
      throw new NotFoundException('Modelo de contrato não encontrado');
    }

    const cliente = await this.clientes.obterPorId(dados.clienteId);
    if (!cliente || cliente.empresaId !== dados.empresaId) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const empresa = await this.empresas.buscarPorId(dados.empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    if (dados.valorTotal != null && dados.valorTotal > 0 && !dados.parcelamento) {
      throw new BadRequestException('Contrato com valor precisa informar o parcelamento');
    }

    const tagsAutomaticas = resolverTagsAutomaticas(
      cliente,
      { razaoSocial: empresa.razaoSocial, nomeFantasia: empresa.nomeFantasia, cnpj: empresa.cnpj },
      { valorTotal: dados.valorTotal, quantidadeParcelas: dados.parcelamento?.quantidadeParcelas ?? null },
    );
    const valoresTags = { ...dados.valoresTagsManuais, ...tagsAutomaticas };
    const conteudoRenderizado = renderizarTags(modelo.conteudoTemplate, valoresTags);

    let contaReceberId: string | null = null;
    if (dados.valorTotal != null && dados.valorTotal > 0 && dados.parcelamento) {
      const configuracao = await this.repositorio.obterConfiguracao(dados.empresaId);
      if (!configuracao?.contaPatrimonialReceberId || !configuracao.contaResultadoReceitaId) {
        throw new BadRequestException('Configure as contas contábeis de contratos (empresas/:empresaId/contratos/configuracao) antes de gerar um contrato com valor');
      }

      contaReceberId = await this.criarContaReceber.executar({
        empresaId: dados.empresaId,
        clienteId: dados.clienteId,
        clienteNome: cliente.nome,
        descricao: `Contrato: ${dados.titulo}`,
        contaPatrimonialId: configuracao.contaPatrimonialReceberId,
        contaResultadoId: configuracao.contaResultadoReceitaId,
        dataEmissao: new Date().toISOString().slice(0, 10),
        criadoPor: dados.criadoPor,
        modo: dados.parcelamento.modo,
        valor: dados.valorTotal,
        quantidadeParcelas: dados.parcelamento.quantidadeParcelas,
        primeiroVencimento: dados.parcelamento.primeiroVencimento,
        intervaloDias: dados.parcelamento.intervaloDias,
      });
    }

    const contrato = await this.repositorio.criarContrato({
      empresaId: dados.empresaId,
      modeloId: dados.modeloId,
      clienteId: dados.clienteId,
      titulo: dados.titulo,
      valoresTags,
      conteudoRenderizado,
      valorTotal: dados.valorTotal,
      contaReceberId,
      criadoPor: dados.criadoPor,
    });

    await this.auditoria.registrar({
      usuarioId: dados.criadoPor,
      empresaId: dados.empresaId,
      acao: 'CRIAR_CONTRATO',
      recurso: `contratos:${contrato.id}`,
      dadosNovos: { clienteId: dados.clienteId, titulo: dados.titulo, valorTotal: dados.valorTotal, contaReceberId },
    });

    return contrato;
  }
}
