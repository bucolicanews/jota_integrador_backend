import { Module } from '@nestjs/common';
import { ContratosModule } from '../contratos/contratos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { AtualizarContadorUseCase } from './aplicacao/casos-de-uso/atualizar-contador.usecase';
import { BloquearContadorUseCase } from './aplicacao/casos-de-uso/bloquear-contador.usecase';
import { CriarContadorUseCase } from './aplicacao/casos-de-uso/criar-contador.usecase';
import { DesbloquearContadorUseCase } from './aplicacao/casos-de-uso/desbloquear-contador.usecase';
import { ListarContadoresUseCase } from './aplicacao/casos-de-uso/listar-contadores.usecase';
import { ObterContadorUseCase } from './aplicacao/casos-de-uso/obter-contador.usecase';
import { CONTADORES_REPOSITORIO } from './aplicacao/portas/contadores-repositorio.port';
import { ContadoresController } from './apresentacao/contadores.controller';
import { ContadoresRepositorioSupabase } from './infraestrutura/contadores.repositorio.supabase';

@Module({
  imports: [EmpresasModule, PlanoDeContasModule, ContratosModule],
  controllers: [ContadoresController],
  providers: [
    { provide: CONTADORES_REPOSITORIO, useClass: ContadoresRepositorioSupabase },
    CriarContadorUseCase,
    ListarContadoresUseCase,
    ObterContadorUseCase,
    AtualizarContadorUseCase,
    BloquearContadorUseCase,
    DesbloquearContadorUseCase,
  ],
  // Exportado seguindo o mesmo padrão de EmpresasModule -- nenhum outro módulo precisa
  // ainda, mas mantém consistência caso surja (ex: validar contador existe antes de
  // criar assinatura/fatura, quando o módulo financeiro for implementado).
  exports: [CONTADORES_REPOSITORIO],
})
export class ContadoresModule {}
