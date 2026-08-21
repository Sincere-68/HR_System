import { Global, Module } from '@nestjs/common';
import { DemoDataService } from './demo-data.service';

@Global()
@Module({
  providers: [DemoDataService],
  exports: [DemoDataService],
})
export class DemoModule {}
