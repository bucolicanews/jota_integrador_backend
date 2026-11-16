import { Module } from '@nestjs/common';
import { ConsultarCnpjUseCase } from './aplicacao/casos-de-uso/consultar-cnpj.usecase';
import { ConsultaCnpjController } from './apresentacao/consulta-cnpj.controller';
import { ConsultaCnpjAuthService } from './infraestrutura/consulta-cnpj-auth.service';
import { ConsultaCnpjClient } from './infraestrutura/consulta-cnpj.client';

@Module({
  controllers: [ConsultaCnpjController],
  providers: [ConsultaCnpjAuthService, ConsultaCnpjClient, ConsultarCnpjUseCase],
})
export class ConsultaCnpjModule {}
