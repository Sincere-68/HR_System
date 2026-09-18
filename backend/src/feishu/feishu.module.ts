import { Module } from '@nestjs/common';
import { FeishuLongConnectionService } from './feishu-long-connection.service';
import { FeishuService } from './feishu.service';

@Module({
  providers: [FeishuService, FeishuLongConnectionService],
  exports: [FeishuService, FeishuLongConnectionService],
})
export class FeishuModule {}
