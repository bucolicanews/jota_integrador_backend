import { Module } from '@nestjs/common';
import { ContasAPagarModule } from '../contas-a-pagar/contas-a-pagar.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { BuscarConfiguracaoLancamentosEsocialUseCase } from './aplicacao/casos-de-uso/buscar-configuracao-lancamentos-esocial.usecase';
import { ImportarRemuneracaoEsocialUseCase } from './aplicacao/casos-de-uso/importar-remuneracao-esocial.usecase';
import { SalvarConfiguracaoLancamentosEsocialUseCase } from './aplicacao/casos-de-uso/salvar-configuracao-lancamentos-esocial.usecase';
import { ESOCIAL_REPOSITORIO } from './aplicacao/portas/esocial-repositorio.port';
import { EsocialController } from './apresentacao/esocial.controller';
import { EsocialRepositorioSupabase } from './infraestrutura/esocial.repositorio.supabase';

@Module({
  // ContasAPagarModule -- ImportarRemuneracaoEsocialUseCase reaproveita CriarContaPagarUseCase
  // (conta+parcela+lançamento já prontos), mesmo padrão de AprovarNotaFiscalUseCase pra entrada
  // de nota fiscal. PlanoDeContasModule -- validação das contas na config de lançamentos.
  imports: [EmpresasModule, ContasAPagarModule, PlanoDeContasModule],
  controllers: [EsocialController],
  providers: [
    { provide: ESOCIAL_REPOSITORIO, useClass: EsocialRepositorioSupabase },
    BuscarConfiguracaoLancamentosEsocialUseCase,
    SalvarConfiguracaoLancamentosEsocialUseCase,
    ImportarRemuneracaoEsocialUseCase,
  ],
})
export class EsocialModule {}
