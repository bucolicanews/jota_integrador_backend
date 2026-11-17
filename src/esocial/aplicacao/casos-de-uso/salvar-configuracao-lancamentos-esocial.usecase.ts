import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { PLANO_CONTAS_REPOSITORIO, PlanoContasRepositorioPort } from '../../../plano-de-contas/aplicacao/portas/plano-contas-repositorio.port';
import { DadosSalvarConfiguracaoLancamentosEsocial, ESOCIAL_REPOSITORIO, EsocialRepositorioPort } from '../portas/esocial-repositorio.port';

type GrupoContaContabil = 'ativo' | 'passivo' | 'patrimonio_liquido' | 'receita' | 'custo' | 'despesa';

/** Contas escolhidas pelo contador pro lançamento automático da folha (importação S-1200) -- mesma validação de SalvarConfiguracaoLancamentosNfUseCase. */
@Injectable()
export class SalvarConfiguracaoLancamentosEsocialUseCase {
  constructor(
    @Inject(ESOCIAL_REPOSITORIO) private readonly repositorio: EsocialRepositorioPort,
    @Inject(PLANO_CONTAS_REPOSITORIO) private readonly planoContas: PlanoContasRepositorioPort,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(dados: DadosSalvarConfiguracaoLancamentosEsocial): Promise<void> {
    await this.validarConta(dados.empresaId, dados.contaDespesaSalarioId, ['despesa']);
    await this.validarConta(dados.empresaId, dados.contaDespesaProLaboreId, ['despesa']);
    await this.validarConta(dados.empresaId, dados.contaDespesaInssId, ['despesa']);
    await this.validarConta(dados.empresaId, dados.contaPassivoInssId, ['passivo']);
    await this.validarConta(dados.empresaId, dados.contaPassivoSalarioAPagarId, ['passivo']);
    await this.validarConta(dados.empresaId, dados.contaPassivoProLaboreAPagarId, ['passivo']);
    if (dados.contaDespesaFgtsId) await this.validarConta(dados.empresaId, dados.contaDespesaFgtsId, ['despesa']);
    if (dados.contaPassivoFgtsId) await this.validarConta(dados.empresaId, dados.contaPassivoFgtsId, ['passivo']);

    await this.repositorio.salvarConfiguracaoLancamentos(dados);

    await this.auditoria.registrar({
      usuarioId: dados.atualizadoPor,
      empresaId: dados.empresaId,
      acao: 'SALVAR_CONFIGURACAO_LANCAMENTOS_ESOCIAL',
      recurso: `configuracoes_lancamentos_esocial:${dados.empresaId}`,
      dadosNovos: dados,
    });
  }

  private async validarConta(empresaId: string, contaId: string, gruposEsperados: GrupoContaContabil[]): Promise<void> {
    const conta = await this.planoContas.buscarPorId(contaId);
    if (!conta || conta.empresaId !== empresaId) {
      throw new NotFoundException('Conta contábil não encontrada');
    }
    if (conta.sintetica) {
      throw new BadRequestException('Conta sintética não recebe lançamento direto');
    }
    if (!gruposEsperados.includes(conta.grupo as GrupoContaContabil)) {
      throw new BadRequestException(`Esperava uma conta do grupo "${gruposEsperados.join('" ou "')}", recebeu "${conta.grupo}"`);
    }
  }
}
