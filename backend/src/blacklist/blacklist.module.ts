import { Module } from '@nestjs/common';
import { BlacklistController } from './blacklist.controller';
import { BlacklistService } from './blacklist.service';

@Module({
  controllers: [BlacklistController],
  providers: [BlacklistService],
})
export class BlacklistModule {}
