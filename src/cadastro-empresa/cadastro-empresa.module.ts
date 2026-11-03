import { Module } from '@nestjs/common';
import { AssinaturasModule } from '../assinaturas/assinaturas.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { PlanoDeContasModule } from '../plano-de-contas/plano-de-contas.module';
import { CadastrarEmpresaComPlanoUseCase } from './aplicacao/casos-de-uso/cadastrar-empresa-com-plano.usecase';
import { CadastroEmpresaController } from './apresentacao/cadastro-empresa.controller';

// CriarUsuarioUseCase não precisa entrar em imports -- AuthModule é @Global() e já
// exporta ele, disponível em qualquer módulo sem precisar listar explicitamente.
// PlanoDeContasModule entra sem ciclo: ele importa EmpresasModule, não o contrário.
@Module({
  imports: [EmpresasModule, AssinaturasModule, PlanoDeContasModule],
  controllers: [CadastroEmpresaController],
  providers: [CadastrarEmpresaComPlanoUseCase],
})
export class CadastroEmpresaModule {}
