import { Module } from '@nestjs/common';
import { AtualizarPlanoRevendaCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/atualizar-plano-revenda-credito-avulso.usecase';
import { CriarPlanoRevendaCreditoAvulsoUseCase } from './aplicacao/casos-de-uso/criar-plano-revenda-credito-avulso.usecase';
import { ListarPlanosRevendaCreditosAvulsosUseCase } from './aplicacao/casos-de-uso/listar-planos-revenda-creditos-avulsos.usecase';
import { PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO } from './aplicacao/portas/planos-revenda-creditos-avulsos-repositorio.port';
import { PlanosRevendaCreditosAvulsosController } from './apresentacao/planos-revenda-creditos-avulsos.controller';
import { PlanosRevendaCreditosAvulsosRepositorioSupabase } from './infraestrutura/planos-revenda-creditos-avulsos.repositorio.supabase';

@Module({
  controllers: [PlanosRevendaCreditosAvulsosController],
  providers: [
    { provide: PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO, useClass: PlanosRevendaCreditosAvulsosRepositorioSupabase },
    CriarPlanoRevendaCreditoAvulsoUseCase,
    ListarPlanosRevendaCreditosAvulsosUseCase,
    AtualizarPlanoRevendaCreditoAvulsoUseCase,
  ],
  exports: [PLANOS_REVENDA_CREDITOS_AVULSOS_REPOSITORIO],
})
export class PlanosRevendaCreditosAvulsosModule {}
