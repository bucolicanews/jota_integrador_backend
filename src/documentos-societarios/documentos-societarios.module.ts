import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { ArquivarDocumentoSocietarioUseCase } from './aplicacao/casos-de-uso/arquivar-documento-societario.usecase';
import { AtualizarBlocoSocietarioUseCase } from './aplicacao/casos-de-uso/atualizar-bloco-societario.usecase';
import { AtualizarDocumentoSocietarioUseCase } from './aplicacao/casos-de-uso/atualizar-documento-societario.usecase';
import { AtualizarModeloSocietarioUseCase } from './aplicacao/casos-de-uso/atualizar-modelo-societario.usecase';
import { CriarBlocoSocietarioUseCase } from './aplicacao/casos-de-uso/criar-bloco-societario.usecase';
import { CriarDocumentoSocietarioUseCase } from './aplicacao/casos-de-uso/criar-documento-societario.usecase';
import { CriarModeloSocietarioUseCase } from './aplicacao/casos-de-uso/criar-modelo-societario.usecase';
import { ExcluirBlocoSocietarioUseCase } from './aplicacao/casos-de-uso/excluir-bloco-societario.usecase';
import { ExcluirDocumentoSocietarioUseCase } from './aplicacao/casos-de-uso/excluir-documento-societario.usecase';
import { ExcluirModeloSocietarioUseCase } from './aplicacao/casos-de-uso/excluir-modelo-societario.usecase';
import { FinalizarDocumentoSocietarioUseCase } from './aplicacao/casos-de-uso/finalizar-documento-societario.usecase';
import { ListarBlocosSocietariosUseCase } from './aplicacao/casos-de-uso/listar-blocos-societarios.usecase';
import { ListarDocumentosSocietariosUseCase } from './aplicacao/casos-de-uso/listar-documentos-societarios.usecase';
import { ListarModelosSocietariosUseCase } from './aplicacao/casos-de-uso/listar-modelos-societarios.usecase';
import { ObterDocumentoSocietarioUseCase } from './aplicacao/casos-de-uso/obter-documento-societario.usecase';
import { ObterModeloSocietarioUseCase } from './aplicacao/casos-de-uso/obter-modelo-societario.usecase';
import { DOCUMENTOS_SOCIETARIOS_REPOSITORIO } from './aplicacao/portas/documentos-societarios-repositorio.port';
import { DocumentosSocietariosController } from './apresentacao/documentos-societarios.controller';
import { DocumentosSocietariosRepositorioSupabase } from './infraestrutura/documentos-societarios.repositorio.supabase';

@Module({
  imports: [EmpresasModule, ClientesModule],
  controllers: [DocumentosSocietariosController],
  providers: [
    { provide: DOCUMENTOS_SOCIETARIOS_REPOSITORIO, useClass: DocumentosSocietariosRepositorioSupabase },
    CriarModeloSocietarioUseCase,
    ListarModelosSocietariosUseCase,
    ObterModeloSocietarioUseCase,
    AtualizarModeloSocietarioUseCase,
    ExcluirModeloSocietarioUseCase,
    CriarBlocoSocietarioUseCase,
    ListarBlocosSocietariosUseCase,
    AtualizarBlocoSocietarioUseCase,
    ExcluirBlocoSocietarioUseCase,
    CriarDocumentoSocietarioUseCase,
    ListarDocumentosSocietariosUseCase,
    ObterDocumentoSocietarioUseCase,
    AtualizarDocumentoSocietarioUseCase,
    ExcluirDocumentoSocietarioUseCase,
    FinalizarDocumentoSocietarioUseCase,
    ArquivarDocumentoSocietarioUseCase,
  ],
})
export class DocumentosSocietariosModule {}
