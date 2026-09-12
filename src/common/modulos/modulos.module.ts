import { Global, Module } from '@nestjs/common';
import { ModulosGuard } from './modulos.guard';

// @Global(): ModulosGuard é usado via @UseGuards() em vários controllers de módulos
// diferentes -- sem @Global() cada um precisaria importar este módulo, mesmo gotcha já
// evitado em SupabaseModule/AuthModule.
@Global()
@Module({
  providers: [ModulosGuard],
  exports: [ModulosGuard],
})
export class ModulosModule {}
