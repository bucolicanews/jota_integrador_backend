import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { renderizarTags } from '../../../common/tags/renderizar-tags';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import { CriarContaReceberUseCase } from '../../../contas-a-receber/aplicacao/casos-de-uso/criar-conta-receber.usecase';
import { gerarParcelas, ModoParcelamento } from '../../../contas-a-receber/dominio/conta-receber';
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
  clienteId: string | null;
  empresaContraparteId: string | null; // exatamente um de clienteId/empresaContraparteId
  titulo: string;
  valoresTagsManuais: Record<string, string>;
  valorTotal: number | null;
  parcelamento: DadosParcelamentoContrato | null; // obrigatório quando valorTotal != null
  criadoPor: string;
}

/**
 * Snapshot imutável: conteudo_renderizado grava o resultado da renderização NESTE
 * momento -- editar modelos_contrato depois não altera nenhum contrato já gerado.
 *
 * Dois modos de contraparte:
 * - clienteId: caso original (Fase 6) -- empresa fatura o PRÓPRIO cliente, só cria
 *   conta_receber na própria empresa (CriarContaReceberUseCase, de sempre).
 * - empresaContraparteId: contador cobrando uma empresa da própria carteira (ex:
 *   ativação de licença de módulo) -- gera os DOIS lados (emitir_cobranca_interna):
 *   conta_receber na empresa emissora (dados.empresaId) + conta_pagar na empresa
 *   contraparte, cada uma com seu próprio lançamento de competência.
 *
 * Ordem importa aqui: o contrato precisa existir ANTES de emitir_cobranca_interna (que
 * grava vinculos_financeiros_espelho.contrato_id) -- por isso o contrato nasce sem
 * conta_receber_id/conta_pagar_id e é atualizado logo em seguida, não o contrário.
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
    if ((dados.clienteId != null) === (dados.empresaContraparteId != null)) {
      throw new BadRequestException('Informe exatamente um: clienteId ou empresaContraparteId');
    }

    const modelo = await this.repositorio.obterModeloPorId(dados.modeloId);
    if (!modelo || modelo.empresaId !== dados.empresaId) {
      throw new NotFoundException('Modelo de contrato não encontrado');
    }

    const empresa = await this.empresas.buscarPorId(dados.empresaId);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    if (dados.valorTotal != null && dados.valorTotal > 0 && !dados.parcelamento) {
      throw new BadRequestException('Contrato com valor precisa informar o parcelamento');
    }

    let nomeContraparte: string;
    let valoresTags: Record<string, string>;
    let configCredora: Awaited<ReturnType<ContratosRepositorioPort['obterConfiguracao']>> = null;
    let configDevedora: Awaited<ReturnType<ContratosRepositorioPort['obterConfiguracao']>> = null;

    if (dados.clienteId) {
      const cliente = await this.clientes.obterPorId(dados.clienteId);
      if (!cliente || cliente.empresaId !== dados.empresaId) {
        throw new NotFoundException('Cliente não encontrado');
      }
      nomeContraparte = cliente.nome;
      const tagsAutomaticas = resolverTagsAutomaticas(
        cliente,
        { razaoSocial: empresa.razaoSocial, nomeFantasia: empresa.nomeFantasia, cnpj: empresa.cnpj },
        { valorTotal: dados.valorTotal, quantidadeParcelas: dados.parcelamento?.quantidadeParcelas ?? null },
      );
      valoresTags = { ...dados.valoresTagsManuais, ...tagsAutomaticas };
    } else {
      const empresaContraparte = await this.empresas.buscarPorId(dados.empresaContraparteId!);
      if (!empresaContraparte) {
        throw new NotFoundException('Empresa contraparte não encontrada');
      }
      nomeContraparte = empresaContraparte.razaoSocial;
      const tagsAutomaticas = resolverTagsAutomaticas(
        { nome: empresaContraparte.razaoSocial, razaoSocial: empresaContraparte.razaoSocial, documento: empresaContraparte.cnpj, email: null, telefone: null, endereco: null },
        { razaoSocial: empresa.razaoSocial, nomeFantasia: empresa.nomeFantasia, cnpj: empresa.cnpj },
        { valorTotal: dados.valorTotal, quantidadeParcelas: dados.parcelamento?.quantidadeParcelas ?? null },
      );
      valoresTags = { ...dados.valoresTagsManuais, ...tagsAutomaticas };
    }

    // Valida a configuração financeira ANTES de criar o contrato -- não faz sentido
    // nascer um contrato "com valor" que nunca vai conseguir gerar a cobrança.
    if (dados.valorTotal != null && dados.valorTotal > 0 && dados.parcelamento) {
      if (dados.clienteId) {
        configCredora = await this.repositorio.obterConfiguracao(dados.empresaId);
        if (!configCredora?.contaPatrimonialReceberId || !configCredora.contaResultadoReceitaId) {
          throw new BadRequestException('Configure as contas contábeis de contratos (empresas/:empresaId/contratos/configuracao) antes de gerar um contrato com valor');
        }
      } else {
        [configCredora, configDevedora] = await Promise.all([
          this.repositorio.obterConfiguracao(dados.empresaId),
          this.repositorio.obterConfiguracao(dados.empresaContraparteId!),
        ]);
        if (!configCredora?.contaPatrimonialReceberId || !configCredora.contaResultadoReceitaId) {
          throw new BadRequestException('Configure as contas contábeis de contratos da empresa emissora antes de gerar uma cobrança com valor');
        }
        if (!configDevedora?.contaPatrimonialPagarId || !configDevedora.contaResultadoDespesaId) {
          throw new BadRequestException('A empresa contraparte precisa configurar as contas de contas a pagar/despesa antes de receber uma cobrança');
        }
      }
    }

    const conteudoRenderizado = renderizarTags(modelo.conteudoTemplate, valoresTags);

    // Nasce sem financeiro -- anexado logo abaixo, depois que o id do contrato existe.
    const contrato = await this.repositorio.criarContrato({
      empresaId: dados.empresaId,
      modeloId: dados.modeloId,
      clienteId: dados.clienteId,
      empresaContraparteId: dados.empresaContraparteId,
      titulo: dados.titulo,
      valoresTags,
      conteudoRenderizado,
      valorTotal: dados.valorTotal,
      contaReceberId: null,
      contaPagarId: null,
      criadoPor: dados.criadoPor,
    });

    let contaReceberId: string | null = null;
    let contaPagarId: string | null = null;

    if (dados.valorTotal != null && dados.valorTotal > 0 && dados.parcelamento) {
      if (dados.clienteId) {
        contaReceberId = await this.criarContaReceber.executar({
          empresaId: dados.empresaId,
          clienteId: dados.clienteId,
          clienteNome: nomeContraparte,
          descricao: `Contrato: ${dados.titulo}`,
          contaPatrimonialId: configCredora!.contaPatrimonialReceberId!,
          contaResultadoId: configCredora!.contaResultadoReceitaId!,
          dataEmissao: new Date().toISOString().slice(0, 10),
          criadoPor: dados.criadoPor,
          modo: dados.parcelamento.modo,
          valor: dados.valorTotal,
          quantidadeParcelas: dados.parcelamento.quantidadeParcelas,
          primeiroVencimento: dados.parcelamento.primeiroVencimento,
          intervaloDias: dados.parcelamento.intervaloDias,
        });
      } else {
        const parcelasGeradas = gerarParcelas(
          dados.parcelamento.modo,
          dados.valorTotal,
          dados.parcelamento.quantidadeParcelas,
          dados.parcelamento.primeiroVencimento,
          dados.parcelamento.intervaloDias,
        );

        const resultado = await this.repositorio.emitirCobrancaInterna({
          empresaCredoraId: dados.empresaId,
          nomeDevedor: nomeContraparte,
          contaPatrimonialCredoraId: configCredora!.contaPatrimonialReceberId!,
          contaResultadoCredoraId: configCredora!.contaResultadoReceitaId!,
          empresaDevedoraId: dados.empresaContraparteId!,
          nomeCredor: empresa.razaoSocial,
          contaResultadoDevedoraId: configDevedora!.contaResultadoDespesaId!,
          contaPatrimonialDevedoraId: configDevedora!.contaPatrimonialPagarId!,
          descricao: `Contrato: ${dados.titulo}`,
          dataEmissao: new Date().toISOString().slice(0, 10),
          criadoPor: dados.criadoPor,
          parcelas: parcelasGeradas,
          contratoId: contrato.id,
        });
        contaReceberId = resultado.contaReceberId;
        contaPagarId = resultado.contaPagarId;
      }

      await this.repositorio.atualizarContrato(contrato.id, { contaReceberId, contaPagarId });
    }

    await this.auditoria.registrar({
      usuarioId: dados.criadoPor,
      empresaId: dados.empresaId,
      acao: 'CRIAR_CONTRATO',
      recurso: `contratos:${contrato.id}`,
      dadosNovos: { clienteId: dados.clienteId, empresaContraparteId: dados.empresaContraparteId, titulo: dados.titulo, valorTotal: dados.valorTotal, contaReceberId, contaPagarId },
    });

    return { ...contrato, contaReceberId, contaPagarId };
  }
}
