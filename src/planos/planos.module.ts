import { Module } from '@nestjs/common';
import { AtualizarPlanoUseCase } from './aplicacao/casos-de-uso/atualizar-plano.usecase';
import { CriarPlanoUseCase } from './aplicacao/casos-de-uso/criar-plano.usecase';
import { ListarPlanosUseCase } from './aplicacao/casos-de-uso/listar-planos.usecase';
import { PLANOS_REPOSITORIO } from './aplicacao/portas/planos-repositorio.port';
import { PlanosController } from './apresentacao/planos.controller';
import { PlanosRepositorioSupabase } from './infraestrutura/planos.repositorio.supabase';

// Extraído de assinaturas/ (2026-10-14) -- catálogo de planos de créditos SERPRO é a
// base tanto de planos-revenda-creditos/ (contador revende) quanto de assinaturas/
// (empresa assina via split PagBank). Precisa ser módulo próprio, sem depender de
// nenhum dos dois, pra não formar import circular -- mesmo papel que pacotes-modulos/
// já tem pra planos-revenda-pacote/licencas-modulo.
@Module({
  controllers: [PlanosController],
  providers: [
    { provide: PLANOS_REPOSITORIO, useClass: PlanosRepositorioSupabase },
    CriarPlanoUseCase,
    ListarPlanosUseCase,
    AtualizarPlanoUseCase,
  ],
  exports: [PLANOS_REPOSITORIO],
})
export class PlanosModule {}
