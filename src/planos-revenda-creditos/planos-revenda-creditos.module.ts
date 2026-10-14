import { Module } from '@nestjs/common';
import { PlanosModule } from '../planos/planos.module';
import { AtualizarPlanoRevendaCreditoUseCase } from './aplicacao/casos-de-uso/atualizar-plano-revenda-credito.usecase';
import { CriarPlanoRevendaCreditoUseCase } from './aplicacao/casos-de-uso/criar-plano-revenda-credito.usecase';
import { ListarPlanosRevendaCreditosUseCase } from './aplicacao/casos-de-uso/listar-planos-revenda-creditos.usecase';
import { PLANOS_REVENDA_CREDITOS_REPOSITORIO } from './aplicacao/portas/planos-revenda-creditos-repositorio.port';
import { PlanosRevendaCreditosController } from './apresentacao/planos-revenda-creditos.controller';
import { PlanosRevendaCreditosRepositorioSupabase } from './infraestrutura/planos-revenda-creditos.repositorio.supabase';

@Module({
  imports: [PlanosModule],
  controllers: [PlanosRevendaCreditosController],
  providers: [
    { provide: PLANOS_REVENDA_CREDITOS_REPOSITORIO, useClass: PlanosRevendaCreditosRepositorioSupabase },
    CriarPlanoRevendaCreditoUseCase,
    ListarPlanosRevendaCreditosUseCase,
    AtualizarPlanoRevendaCreditoUseCase,
  ],
  exports: [PLANOS_REVENDA_CREDITOS_REPOSITORIO],
})
export class PlanosRevendaCreditosModule {}
