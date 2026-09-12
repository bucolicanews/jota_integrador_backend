import { Global, Module } from '@nestjs/common';
import { UsuarioSistemaService } from './usuario-sistema.service';

@Global()
@Module({
  providers: [UsuarioSistemaService],
  exports: [UsuarioSistemaService],
})
export class UsuarioSistemaModule {}
