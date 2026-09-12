import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { renderizarTags } from '../../../common/tags/renderizar-tags';
import { CLIENTES_REPOSITORIO, ClientesRepositorioPort } from '../../../clientes/aplicacao/portas/clientes-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import { resolverTagsAutomaticas } from '../../dominio/contrato';
import { CONTRATOS_REPOSITORIO, ContratosRepositorioPort } from '../portas/contratos-repositorio.port';

export interface DadosPreVisualizarContrato {
  empresaId: string;
  modeloId: string;
  clienteId: string;
  valoresTagsManuais: Record<string, string>;
  valorTotal: number | null;
  quantidadeParcelas: number | null;
}

export interface ResultadoPreVisualizarContrato {
  conteudoRenderizado: string;
  valoresTags: Record<string, string>;
}

/** Não persiste nada -- só resolve tags e renderiza, pra tela mostrar o preview ao vivo antes de confirmar a criação. */
@Injectable()
export class PreVisualizarContratoUseCase {
  constructor(
    @Inject(CONTRATOS_REPOSITORIO) private readonly repositorio: ContratosRepositorioPort,
    @Inject(CLIENTES_REPOSITORIO) private readonly clientes: ClientesRepositorioPort,
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresas: EmpresasRepositorioPort,
  ) {}

  async executar(dados: DadosPreVisualizarContrato): Promise<ResultadoPreVisualizarContrato> {
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

    const tagsAutomaticas = resolverTagsAutomaticas(
      cliente,
      { razaoSocial: empresa.razaoSocial, nomeFantasia: empresa.nomeFantasia, cnpj: empresa.cnpj },
      { valorTotal: dados.valorTotal, quantidadeParcelas: dados.quantidadeParcelas },
    );

    // Tag automática sempre vence uma manual de mesmo nome -- ver comentário em resolverTagsAutomaticas.
    const valoresTags = { ...dados.valoresTagsManuais, ...tagsAutomaticas };

    return {
      conteudoRenderizado: renderizarTags(modelo.conteudoTemplate, valoresTags),
      valoresTags,
    };
  }
}
