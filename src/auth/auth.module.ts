import { Global, Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module';
import { AtualizarNomeProprioUseCase } from './aplicacao/casos-de-uso/atualizar-nome-proprio.usecase';
import { AtualizarPapelUsuarioUseCase } from './aplicacao/casos-de-uso/atualizar-papel-usuario.usecase';
import { BloquearUsuarioUseCase } from './aplicacao/casos-de-uso/bloquear-usuario.usecase';
import { ConcederPermissaoUseCase } from './aplicacao/casos-de-uso/conceder-permissao.usecase';
import { CriarUsuarioUseCase } from './aplicacao/casos-de-uso/criar-usuario.usecase';
import { DesbloquearUsuarioUseCase } from './aplicacao/casos-de-uso/desbloquear-usuario.usecase';
import { ListarPermissoesUsuarioUseCase } from './aplicacao/casos-de-uso/listar-permissoes-usuario.usecase';
import { LogoutGlobalUseCase } from './aplicacao/casos-de-uso/logout-global.usecase';
import { ObterPerfilUseCase } from './aplicacao/casos-de-uso/obter-perfil.usecase';
import { RevogarPermissaoUseCase } from './aplicacao/casos-de-uso/revogar-permissao.usecase';
import { PERMISSOES_REPOSITORIO } from './aplicacao/portas/permissoes-repositorio.port';
import { PROVEDOR_IDENTIDADE } from './aplicacao/portas/provedor-identidade.port';
import { USUARIOS_REPOSITORIO } from './aplicacao/portas/usuarios-repositorio.port';
import { AuthController } from './apresentacao/auth.controller';
import { PapeisGuard } from './apresentacao/guards/papeis.guard';
import { PermissoesGuard } from './apresentacao/guards/permissoes.guard';
import { SupabaseAuthGuard } from './apresentacao/guards/supabase-auth.guard';
import { PermissoesRepositorioSupabase } from './infraestrutura/permissoes.repositorio.supabase';
import { ProvedorIdentidadeSupabase } from './infraestrutura/provedor-identidade.supabase';
import { UsuariosRepositorioSupabase } from './infraestrutura/usuarios.repositorio.supabase';

// @Global(): SupabaseAuthGuard/PapeisGuard protegem rotas de outros módulos (empresas/
// já usa; certificados, créditos, etc. vão usar). Sem @Global(), cada módulo novo
// precisaria importar AuthModule explicitamente, e esquecer um só quebra a resolução de
// DI em runtime (mesmo gotcha já documentado no DeliveryHub para guard/interceptor
// compartilhado -- ver [[project_deliveryhub]] na memória).
@Global()
@Module({
  imports: [EmpresasModule], // EMPRESAS_REPOSITORIO -- checagem de posse em CriarUsuario
  controllers: [AuthController],
  providers: [
    { provide: USUARIOS_REPOSITORIO, useClass: UsuariosRepositorioSupabase },
    { provide: PROVEDOR_IDENTIDADE, useClass: ProvedorIdentidadeSupabase },
    { provide: PERMISSOES_REPOSITORIO, useClass: PermissoesRepositorioSupabase },
    CriarUsuarioUseCase,
    AtualizarNomeProprioUseCase,
    AtualizarPapelUsuarioUseCase,
    BloquearUsuarioUseCase,
    DesbloquearUsuarioUseCase,
    ObterPerfilUseCase,
    LogoutGlobalUseCase,
    ListarPermissoesUsuarioUseCase,
    ConcederPermissaoUseCase,
    RevogarPermissaoUseCase,
    SupabaseAuthGuard,
    PapeisGuard,
    PermissoesGuard,
  ],
  exports: [SupabaseAuthGuard, PapeisGuard, PermissoesGuard, PROVEDOR_IDENTIDADE, USUARIOS_REPOSITORIO, PERMISSOES_REPOSITORIO],
})
export class AuthModule {}
