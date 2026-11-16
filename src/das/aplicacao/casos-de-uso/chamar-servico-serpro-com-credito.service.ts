import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DebitarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/debitar-creditos.usecase';
import { EstornarCreditosUseCase } from '../../../creditos/aplicacao/casos-de-uso/estornar-creditos.usecase';
import { custoDaOperacao } from '../../../creditos/dominio/credito';
import { SaldoInsuficienteError } from '../../../creditos/aplicacao/portas/creditos-repositorio.port';
import { Empresa } from '../../../empresas/aplicacao/portas/empresas-repositorio.port';
import {
  CONSULTAS_SERPRO_REPOSITORIO,
  ConsultasSerproRepositorioPort,
} from '../../../serpro/aplicacao/portas/consultas-serpro-repositorio.port';
import { FuncionalidadeSerpro, SERPRO_GATEWAY, SerproGatewayPort } from '../../../serpro/aplicacao/portas/serpro-gateway.port';
import { VerificarCotaIncluidaUseCase } from './verificar-cota-incluida.usecase';

export interface ParametrosChamadaServicoSerpro {
  idSistema: string;
  idServico: string;
  dados: string;
  custoOperacao: string;
  motivo: string;
  funcionalidade?: FuncionalidadeSerpro;
}

export interface ResultadoChamadaServicoSerpro {
  sucesso: boolean;
  corpo: unknown;
}

/**
 * Saga completa de toda chamada SERPRO que consome crédito (cota incluída no plano ->
 * débito -> chamada -> estorno-se-falhar -> log em consultas_serpro) -- extraída de
 * `SincronizarDasEmpresaUseCase.chamarServico` pra não duplicar uma 3ª vez em
 * `TransmitirDeclaracaoPgdasdUseCase`. `SincronizarDasEmpresaUseCase`/
 * `GerarSegundaViaDasUseCase` mantêm a cópia própria deles por ora (já confirmados em
 * produção real -- não tocar nesse código funcionando só pra DRY) -- só o usecase novo
 * usa este serviço compartilhado.
 */
@Injectable()
export class ChamarServicoSerproComCreditoService {
  constructor(
    @Inject(SERPRO_GATEWAY) private readonly gateway: SerproGatewayPort,
    @Inject(CONSULTAS_SERPRO_REPOSITORIO) private readonly consultasRepositorio: ConsultasSerproRepositorioPort,
    private readonly debitarCreditos: DebitarCreditosUseCase,
    private readonly estornarCreditos: EstornarCreditosUseCase,
    private readonly verificarCotaIncluida: VerificarCotaIncluidaUseCase,
  ) {}

  async executar(empresa: Empresa, planoId: string | null, params: ParametrosChamadaServicoSerpro): Promise<ResultadoChamadaServicoSerpro> {
    const dentroDaCota = await this.verificarCotaIncluida.executar(empresa.id, planoId, params.idSistema);
    if (!dentroDaCota) {
      try {
        await this.debitarCreditos.executar(empresa.contadorId, empresa.id, params.custoOperacao, params.motivo);
      } catch (erro) {
        if (erro instanceof SaldoInsuficienteError) {
          throw new ForbiddenException('Saldo de créditos insuficiente pra consultar o SERPRO');
        }
        throw erro;
      }
    }

    let sucesso = false;
    let codigoErro: string | null = null;
    let corpo: unknown = null;

    try {
      const resposta = await this.gateway.consultar({
        idSistema: params.idSistema,
        idServico: params.idServico,
        contribuinteCnpj: empresa.cnpj,
        dados: params.dados,
        funcionalidade: params.funcionalidade,
      });
      sucesso = resposta.sucesso;
      corpo = resposta.corpo;
      if (!sucesso) codigoErro = `HTTP_${resposta.statusHttp}`;
    } catch {
      codigoErro = 'ERRO_COMUNICACAO';
    }

    if (!sucesso && !dentroDaCota) {
      await this.estornarCreditos.executar(
        empresa.contadorId,
        empresa.id,
        custoDaOperacao(params.custoOperacao),
        `${params.motivo} falhou (${codigoErro})`,
      );
    }

    await this.consultasRepositorio.registrar({
      contadorId: empresa.contadorId,
      empresaId: empresa.id,
      idSistema: params.idSistema,
      idServico: params.idServico,
      sucesso,
      codigoErro,
      creditosConsumidos: sucesso && !dentroDaCota ? custoDaOperacao(params.custoOperacao) : 0,
    });

    return { sucesso, corpo };
  }
}
