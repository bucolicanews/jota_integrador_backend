import { Module } from '@nestjs/common';
import { ChavePublicaCartaoController } from './chave-publica-cartao.controller';
import { PagbankConfigService } from './pagbank-config.service';

@Module({
  controllers: [ChavePublicaCartaoController],
  providers: [PagbankConfigService],
  exports: [PagbankConfigService],
})
export class PagbankModule {}
