import { Inject, Injectable } from '@nestjs/common';
import { DebitarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/debitar-creditos.usecase';
import { EstornarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/estornar-creditos.usecase';
import { custoDaOperacao } from '../../../creditos/dominio/credito';
import { SaldoInsuficienteError } from '../../../creditos/aplicacao/portas/creditos-repositorio.port';
import { EMPRESAS_REPOSITORIO, EmpresasRepositorioPort } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../portas/consultas-serpro-repositorio.port';
import { SERPRO_GATEWAY, SerproGatewayPort } from '../portas/serpro-gateway.port';
import { VERIFICAR_ACESSO_SERPRO, VerificarAcessoSerproPort } from '../portas/verificar-acesso-serpro.port';

const ID_SISTEMA = 'CAIXAPOSTAL';
const ID_SERVICO = 'MSGCONTRIBUINTE61';
const CUSTO_OPERACAO = 'CAIXA_POSTAL';

export interface ResultadoTesteConexao {
  sucesso: boolean;
  motivo: string | null;
}

/**
 * Chamada real mínima ao SERPRO (listar 1 página da Caixa Postal, mesmo idSistema/idServico
 * confirmado contra produção em SincronizarMensagensUseCase) só pra provar que a
 * procuração/certificado cadastrado funciona de ponta a ponta -- não salva mensagem
 * nenhuma, só prova a conexão. De propósito SEM exigir assinatura ativa nem módulo
 * fiscal liberado (diferente de SincronizarMensagensUseCase) -- é um diagnóstico de
 * setup, precisa funcionar antes de qualquer plano, logo depois da empresa cadastrar
 * a procuração (motivo do pedido: 403 testando acesso numa empresa recém-criada sem
 * plano ainda). Continua custando 1 chamada de crédito de verdade (avulso cobre).
 */
@Injectable()
export class TestarConexaoSerproUseCase {
  constructor(
    @Inject(EMPRESAS_REPOSITORIO) private readonly empresasRepositorio: EmpresasRepositorioPort,
    @Inject(VERIFICAR_ACESSO_SERPRO) private readonly verificarAcesso: VerificarAcessoSerproPort,
    @Inject(SERPRO_GATEWAY) private readonly gateway: SerproGatewayPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasRepositorio: ConsultasSerproRepositorioPort,
    private readonly debitarCreditos: DebitarCreditosUseCase,
    private readonly estornarCreditos: EstornarCreditosUseCase,
  ) {}

  async executar(empresaId: string): Promise<ResultadoTesteConexao> {
    const empresa = await this.empresasRepositorio.buscarPorId(empresaId);
    if (!empresa) {
      return { sucesso: false, motivo: 'Empresa não encontrada' };
    }

    const acesso = await this.verificarAcesso.possuiAcessoValido(empresaId);
    if (!acesso.valido) {
      return { sucesso: false, motivo: acesso.motivo ?? 'Empresa sem acesso válido ao SERPRO' };
    }

    try {
      await this.debitarCreditos.executar(empresa.contadorId, empresaId, CUSTO_OPERACAO, `Testar conexão SERPRO -- empresa ${empresaId}`);
    } catch (erro) {
      if (erro instanceof SaldoInsuficienteError) {
        return { sucesso: false, motivo: 'Saldo de créditos insuficiente pra testar a conexão' };
      }
      throw erro;
    }

    let sucesso = false;
    let codigoErro: string | null = null;

    try {
      const resposta = await this.gateway.consultar({
        idSistema: ID_SISTEMA,
        idServico: ID_SERVICO,
        contribuinteCnpj: empresa.cnpj,
        dados: JSON.stringify({ statusLeitura: '0', indicadorPagina: '0', ponteiroPagina: '0'.repeat(24) }),
        documentoTrial: '99999999999999',
      });
      sucesso = resposta.sucesso;
      if (!sucesso) codigoErro = `HTTP_${resposta.statusHttp}`;
    } catch {
      codigoErro = 'ERRO_COMUNICACAO';
    }

    if (!sucesso) {
      await this.estornarCreditos.executar(
        empresa.contadorId,
        empresaId,
        custoDaOperacao(CUSTO_OPERACAO),
        `Teste de conexão SERPRO falhou (${codigoErro})`,
      );
    }

    await this.consultasRepositorio.registrar({
      contadorId: empresa.contadorId,
      empresaId,
      idSistema: ID_SISTEMA,
      idServico: ID_SERVICO,
      sucesso,
      codigoErro,
      creditosConsumidos: sucesso ? custoDaOperacao(CUSTO_OPERACAO) : 0,
    });

    return sucesso
      ? { sucesso: true, motivo: null }
      : { sucesso: false, motivo: 'O SERPRO não respondeu corretamente -- confira a procuração/certificado e tente de novo' };
  }
}
