import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProcessarTentativaLoginUseCase } from './aplicacao/processar-tentativa-login.usecase';
import { VerificacaoSenhaController } from './apresentacao/verificacao-senha.controller';

@Module({
  imports: [AuthModule],
  controllers: [VerificacaoSenhaController],
  providers: [ProcessarTentativaLoginUseCase],
})
export class SupabaseHooksModule {}
