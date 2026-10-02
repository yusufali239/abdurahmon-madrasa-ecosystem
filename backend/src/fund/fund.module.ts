import { Global, Module } from '@nestjs/common';
import { FundBot } from './fund.bot';
import { FundController } from './fund.controller';
import { FundService } from './fund.service';

@Global()
@Module({
  controllers: [FundController],
  providers: [FundService, FundBot],
  exports: [FundService],
})
export class FundModule {}
