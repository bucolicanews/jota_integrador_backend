import { Module } from '@nestjs/common';
import { PagbankConfigService } from './pagbank-config.service';

@Module({
  providers: [PagbankConfigService],
  exports: [PagbankConfigService],
})
export class PagbankModule {}
