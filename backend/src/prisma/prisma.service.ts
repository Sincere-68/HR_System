import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly demoMode: boolean;

  constructor(config: ConfigService) {
    super();
    this.demoMode = config.get<boolean>('DEMO_MODE', true);
  }

  async onModuleInit() {
    if (!this.demoMode) await this.$connect();
  }

  async onModuleDestroy() {
    if (!this.demoMode) await this.$disconnect();
  }
}
