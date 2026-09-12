import { Module } from '@nestjs/common';
import { AtualizarPacoteModulosUseCase } from './aplicacao/casos-de-uso/atualizar-pacote-modulos.usecase';
import { CriarPacoteModulosUseCase } from './aplicacao/casos-de-uso/criar-pacote-modulos.usecase';
import { DesativarPacoteModulosUseCase } from './aplicacao/casos-de-uso/desativar-pacote-modulos.usecase';
import { ListarPacotesModulosUseCase } from './aplicacao/casos-de-uso/listar-pacotes-modulos.usecase';
import { PACOTES_MODULOS_REPOSITORIO } from './aplicacao/portas/pacotes-modulos-repositorio.port';
import { PacotesModulosController } from './apresentacao/pacotes-modulos.controller';
import { PacotesModulosRepositorioSupabase } from './infraestrutura/pacotes-modulos.repositorio.supabase';

@Module({
  controllers: [PacotesModulosController],
  providers: [
    { provide: PACOTES_MODULOS_REPOSITORIO, useClass: PacotesModulosRepositorioSupabase },
    CriarPacoteModulosUseCase,
    ListarPacotesModulosUseCase,
    AtualizarPacoteModulosUseCase,
    DesativarPacoteModulosUseCase,
  ],
  exports: [PACOTES_MODULOS_REPOSITORIO],
})
export class PacotesModulosModule {}
