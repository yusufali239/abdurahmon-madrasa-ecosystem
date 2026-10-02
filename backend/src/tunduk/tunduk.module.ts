import { Global, Module } from '@nestjs/common';
import { TundukService } from './tunduk.service';

@Global()
@Module({
  providers: [TundukService],
  exports: [TundukService],
})
export class TundukModule {}
