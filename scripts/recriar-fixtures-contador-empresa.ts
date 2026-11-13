import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CriarContadorUseCase } from '../src/contadores/aplicacao/casos-de-uso/criar-contador.usecase';
import { CriarUsuarioUseCase } from '../src/auth/aplicacao/casos-de-uso/criar-usuario.usecase';
import { CadastrarEmpresaComPlanoUseCase } from '../src/cadastro-empresa/aplicacao/casos-de-uso/cadastrar-empresa-com-plano.usecase';
import { USUARIOS_REPOSITORIO, UsuariosRepositorioPort } from '../src/auth/aplicacao/portas/usuarios-repositorio.port';
import { PROVEDOR_IDENTIDADE, ProvedorIdentidadePort } from '../src/auth/aplicacao/portas/provedor-identidade.port';
import { Papel } from '../src/auth/dominio/papel';

/**
 * Script pontual pra recriar fixtures locais perdidos num reset de banco:
 * contador (jmokatavares@gmail.com) + empresa-cliente dele (jotaempresasonline@gmail.com).
 * Só ambiente local -- nunca rodar contra produção.
 */
const SENHA_FIXA = 'Teste@123456';
const PLANO_ID = '1b2fd3aa-0c44-4676-a7e2-207701b72b1d';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const usuariosRepositorio = app.get<UsuariosRepositorioPort>(USUARIOS_REPOSITORIO);
    const provedorIdentidade = app.get<ProvedorIdentidadePort>(PROVEDOR_IDENTIDADE);
    const criarContador = app.get(CriarContadorUseCase);
    const criarUsuario = app.get(CriarUsuarioUseCase);
    const cadastrarEmpresaComPlano = app.get(CadastrarEmpresaComPlanoUseCase);

    const contador = await criarContador.executar({
      nome: 'J Mokatavares Contabilidade',
      cnpjCpf: '52998224725',
      email: 'jmokatavares@gmail.com',
      telefone: null,
    });
    console.log(`Contador criado: ${contador.id}`);

    const infoPapelContadorDono = await usuariosRepositorio.buscarPapelPorNome(Papel.CONTADOR_DONO, {
      contadorId: null,
      empresaId: null,
    });
    const usuarioContador = await criarUsuario.executar({
      nome: 'J Mokatavares',
      email: 'jmokatavares@gmail.com',
      infoPapel: infoPapelContadorDono,
      contadorId: contador.id,
      empresaId: null,
    });
    await provedorIdentidade.atualizarSenha(usuarioContador.id, SENHA_FIXA);
    console.log(`Usuario CONTADOR_DONO criado: ${usuarioContador.email} (id ${usuarioContador.id})`);

    const resultadoEmpresa = await cadastrarEmpresaComPlano.executar({
      contadorId: contador.id,
      razaoSocial: 'Jota Empresas Online',
      nomeFantasia: 'Jota Empresas Online',
      cnpj: '11444777000161',
      regimeTributario: 'simples_nacional',
      modoAcessoSerpro: 'procuracao',
      planoId: PLANO_ID,
      cobranca: 'gratis',
      clienteNome: 'Jota Empresas Online',
      clienteEmail: 'jotaempresasonline@gmail.com',
    });
    await provedorIdentidade.atualizarSenha(resultadoEmpresa.usuario.id, SENHA_FIXA);
    console.log(`Empresa criada: ${resultadoEmpresa.empresa.id}`);
    console.log(`Usuario EMPRESARIO_DONO criado: ${resultadoEmpresa.usuario.email} (id ${resultadoEmpresa.usuario.id})`);

    console.log('--- Fixtures recriados ---');
    console.log(`Admin:    bacudigital@gmail.com (senha já existente)`);
    console.log(`Contador: jmokatavares@gmail.com / ${SENHA_FIXA}`);
    console.log(`Empresa:  jotaempresasonline@gmail.com / ${SENHA_FIXA}`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((erro) => {
  console.error('Falha ao recriar fixtures:', erro.message ?? erro);
  process.exit(1);
});
