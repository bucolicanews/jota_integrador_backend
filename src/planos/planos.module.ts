import { Module } from '@nestjs/common';
import { AtualizarPlanoUseCase } from './aplicacao/casos-de-uso/atualizar-plano.usecase';
import { CriarPlanoUseCase } from './aplicacao/casos-de-uso/criar-plano.usecase';
import { DefinirConsultaIncluidaUseCase } from './aplicacao/casos-de-uso/definir-consulta-incluida.usecase';
import { ListarConsultasIncluidasUseCase } from './aplicacao/casos-de-uso/listar-consultas-incluidas.usecase';
import { ListarPlanosUseCase } from './aplicacao/casos-de-uso/listar-planos.usecase';
import { RemoverConsultaIncluidaUseCase } from './aplicacao/casos-de-uso/remover-consulta-incluida.usecase';
import { PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO } from './aplicacao/portas/plano-consultas-incluidas-repositorio.port';
import { PLANOS_REPOSITORIO } from './aplicacao/portas/planos-repositorio.port';
import { PlanoConsultasIncluidasController } from './apresentacao/plano-consultas-incluidas.controller';
import { PlanosController } from './apresentacao/planos.controller';
import { PlanoConsultasIncluidasRepositorioSupabase } from './infraestrutura/plano-consultas-incluidas.repositorio.supabase';
import { PlanosRepositorioSupabase } from './infraestrutura/planos.repositorio.supabase';

// Extraído de assinaturas/ (2026-10-14) -- catálogo de planos de créditos SERPRO é a
// base tanto de planos-revenda-creditos/ (contador revende) quanto de assinaturas/
// (empresa assina via split PagBank). Precisa ser módulo próprio, sem depender de
// nenhum dos dois, pra não formar import circular -- mesmo papel que pacotes-modulos/
// já tem pra planos-revenda-pacote/licencas-modulo. Mesmo motivo pelo qual
// VerificarCotaIncluidaUseCase mora em das/ (consumidor único hoje) e não aqui --
// aqui precisaria de SerproModule, que importa AssinaturasModule, que importa
// PlanosModule: ciclo.
@Module({
  controllers: [PlanosController, PlanoConsultasIncluidasController],
  providers: [
    { provide: PLANOS_REPOSITORIO, useClass: PlanosRepositorioSupabase },
    { provide: PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO, useClass: PlanoConsultasIncluidasRepositorioSupabase },
    CriarPlanoUseCase,
    ListarPlanosUseCase,
    AtualizarPlanoUseCase,
    ListarConsultasIncluidasUseCase,
    DefinirConsultaIncluidaUseCase,
    RemoverConsultaIncluidaUseCase,
  ],
  exports: [PLANOS_REPOSITORIO, PLANO_CONSULTAS_INCLUIDAS_REPOSITORIO],
})
export class PlanosModule {}
