import { Inject, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  CONFIGURACAO_PLATAFORMA_REPOSITORIO,
  ConfiguracaoPagbank,
  ConfiguracaoPlataformaRepositorioPort,
  DadosAtualizacaoConfiguracaoPagbank,
} from '../portas/configuracao-plataforma-repositorio.port';

/** Config do PagBank da plataforma -- conta/sandbox/kill-switch do split (token fica só em .env, nunca aqui). */
@Injectable()
export class GerenciarConfiguracaoPagbankUseCase {
  constructor(
    @Inject(CONFIGURACAO_PLATAFORMA_REPOSITORIO)
    private readonly configuracaoRepositorio: ConfiguracaoPlataformaRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async obter(): Promise<ConfiguracaoPagbank> {
    return this.configuracaoRepositorio.obterConfiguracaoPagbank();
  }

  async atualizar(dados: DadosAtualizacaoConfiguracaoPagbank, executadoPorId: string): Promise<void> {
    const anterior = await this.configuracaoRepositorio.obterConfiguracaoPagbank();
    await this.configuracaoRepositorio.atualizarConfiguracaoPagbank(dados);

    await this.auditoria.registrar({
      usuarioId: executadoPorId,
      acao: 'configuracoes_plataforma.atualizar_pagbank',
      recurso: 'configuracoes_plataforma',
      dadosAntigos: anterior,
      dadosNovos: { ...anterior, ...dados },
    });
  }
}
