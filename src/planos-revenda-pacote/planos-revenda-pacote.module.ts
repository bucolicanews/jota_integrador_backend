import { Module } from '@nestjs/common';
import { PacotesModulosModule } from '../pacotes-modulos/pacotes-modulos.module';
import { AtualizarPlanoRevendaUseCase } from './aplicacao/casos-de-uso/atualizar-plano-revenda.usecase';
import { CriarPlanoRevendaUseCase } from './aplicacao/casos-de-uso/criar-plano-revenda.usecase';
import { ListarPlanosRevendaUseCase } from './aplicacao/casos-de-uso/listar-planos-revenda.usecase';
import { PLANOS_REVENDA_PACOTE_REPOSITORIO } from './aplicacao/portas/planos-revenda-pacote-repositorio.port';
import { PlanosRevendaPacoteController } from './apresentacao/planos-revenda-pacote.controller';
import { PlanosRevendaPacoteRepositorioSupabase } from './infraestrutura/planos-revenda-pacote.repositorio.supabase';

@Module({
  imports: [PacotesModulosModule],
  controllers: [PlanosRevendaPacoteController],
  providers: [
    { provide: PLANOS_REVENDA_PACOTE_REPOSITORIO, useClass: PlanosRevendaPacoteRepositorioSupabase },
    CriarPlanoRevendaUseCase,
    ListarPlanosRevendaUseCase,
    AtualizarPlanoRevendaUseCase,
  ],
  exports: [PLANOS_REVENDA_PACOTE_REPOSITORIO],
})
export class PlanosRevendaPacoteModule {}
