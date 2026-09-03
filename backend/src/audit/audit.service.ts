import { Injectable } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoDataService,
  ) {}

  create(
    context: AuditContext,
    action: AuditAction,
    resourceId: string | undefined,
    metadata?: Prisma.InputJsonValue,
    client: Prisma.TransactionClient = this.prisma,
    resourceType = 'employee',
  ) {
    if (this.demo.enabled) {
      this.demo.recordAudit(context, action, resourceId, metadata);
      return Promise.resolve();
    }

    return client.auditLog.create({
      data: {
        userId: context.userId,
        action,
        resourceType,
        resourceId,
        metadata,
        ipAddress: context.ipAddress?.slice(0, 64),
        userAgent: context.userAgent?.slice(0, 512),
      },
    });
  }
}
