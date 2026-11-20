import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { LancamentosContabeisModule } from '../lancamentos-contabeis/lancamentos-contabeis.module';
import { NotasFiscaisModule } from '../notas-fiscais/notas-fiscais.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { CalcularApuracaoSimplesUseCase } from './aplicacao/casos-de-uso/calcular-apuracao-simples.usecase';
import { CalcularFatorRUseCase } from './aplicacao/casos-de-uso/calcular-fator-r.usecase';
import { CalcularRbt12UseCase } from './aplicacao/casos-de-uso/calcular-rbt12.usecase';
import { ConsultarRtcSimplesNacionalUseCase } from './aplicacao/casos-de-uso/consultar-rtc-simples-nacional.usecase';
import { DefinirReceitaMensalUseCase } from './aplicacao/casos-de-uso/definir-receita-mensal.usecase';
import { RECEITAS_MENSAIS_REPOSITORIO } from './aplicacao/portas/receitas-mensais-repositorio.port';
import { ApuracaoSimplesController } from './apresentacao/apuracao-simples.controller';
import { CalculadoraRtcSimplesNacionalClient } from './infraestrutura/calculadora-rtc-simples-nacional.client';
import { ReceitasMensaisRepositorioSupabase } from './infraestrutura/receitas-mensais.repositorio.supabase';

@Module({
  // PlanoDeContasModule/LancamentosContabeisModule -- CalcularFatorRUseCase precisa das
  // contas marcadas conta_folha_pagamento e do movimento delas nos 12 meses.
  imports: [EmpresasModule, NotasFiscaisModule, PlanoDeContasModule, LancamentosContabeisModule],
  controllers: [ApuracaoSimplesController],
  providers: [
    { provide: RECEITAS_MENSAIS_REPOSITORIO, useClass: ReceitasMensaisRepositorioSupabase },
    CalcularRbt12UseCase,
    CalcularFatorRUseCase,
    CalcularApuracaoSimplesUseCase,
    DefinirReceitaMensalUseCase,
    CalculadoraRtcSimplesNacionalClient,
    ConsultarRtcSimplesNacionalUseCase,
  ],
  // CalcularApuracaoSimplesUseCase/RECEITAS_MENSAIS_REPOSITORIO -- usados por
  // TransmitirDeclaracaoPgdasdUseCase (src/das) pra montar o payload da declaração real
  // a partir do mesmo cálculo oficial que já alimenta o painel.
  exports: [CalcularApuracaoSimplesUseCase, RECEITAS_MENSAIS_REPOSITORIO],
})
export class ApuracaoSimplesModule {}
