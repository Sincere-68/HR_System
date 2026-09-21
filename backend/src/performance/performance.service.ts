import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  AssignmentStatus,
  AuditAction,
  PerformanceCyclePeriodType,
  PerformanceDirectoryType,
  PerformanceExceptionHandlerType,
  PerformanceExecutionMode,
  PerformanceExecutorType,
  PerformanceModuleType,
  PerformanceTemplateSourceType,
  PerformanceVersionStatus,
  PerformanceWorkflowAction,
  PerformanceWorkflowActionSource,
  PerformanceWorkflowRejectionStrategy,
  PerformanceWorkflowStepType,
  Prisma,
  ProcessStatus,
  RecordStatus,
  TaskStatus,
} from '@prisma/client';
import type {
  AuthenticatedUser,
} from '../common/types/authenticated-user';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService } from '../audit/audit.service';
import { DemoDataService } from '../demo/demo-data.service';
import { FeishuLongConnectionService } from '../feishu/feishu-long-connection.service';
import type { FeishuCard } from '../feishu/feishu.service';
import { FeishuService } from '../feishu/feishu.service';
import { FeishuTaskSessionService, type FeishuTaskPrincipal } from './feishu-task-session.service';
import { PrismaService } from '../prisma/prisma.service';
import { PERFORMANCE_DATA_ADAPTER, type PerformanceDataAdapter } from './performance-data.adapter';
import { PerformanceRuleEngine } from './performance-rule-engine';
import { PerformanceTemplateParser } from './performance-template.parser';
import {
  AddPerformanceCycleParticipantsDto,
  ArchivePerformanceCycleDto,
  PerformanceCycleParticipantsActionDto,
  ArchivePerformanceTemplateDto,
  CreateCycleParticipantAmountBaseDto,
  CreatePerformanceCycleDto,
  UpdatePerformanceCycleParticipantTemplateDto,
  CreatePerformanceTemplateDto,
  ModifyPerformanceResultDto,
  ParsePerformanceTemplateDto,
  PerformanceTaskSubmissionDto,
  PerformanceWorkflowTaskSubmissionDto,
  QueryPerformanceDto,
  CreateEmployeePerformanceAmountBaseDto,
  QueryEmployeePerformanceAmountBaseDto,
} from './dto/performance.dto';
import type { PerformanceExecutorDefinition, PerformanceFeishuTaskInbox, PerformanceModuleDefinition, PerformanceTemplateDefinition, PerformanceWorkflowManualStepDefinition } from '@hr-demo/shared';

const DECIMAL = (value: number) => new Prisma.Decimal(value.toFixed(4));
const MONEY = (value: number) => new Prisma.Decimal(value.toFixed(2));

type PerformanceTaskAssigneeRecord = {
  id: string;
  taskId: string;
  employeeId: string | null;
  userId: string | null;
  displayNameSnapshot: string;
  accountSnapshot: string | null;
  status: TaskStatus;
  submission: Prisma.JsonValue | null;
  score: Prisma.Decimal | null;
  completedAt: Date | null;
};

type PerformanceWorkflowTaskAssigneeRecord = {
  id: string;
  taskId: string;
  employeeId: string;
  userId: string | null;
  displayNameSnapshot: string;
  accountSnapshot: string | null;
  status: TaskStatus;
  cardTokenHash: string | null;
  cardIssuedAt: Date | null;
  cardConsumedAt: Date | null;
  completedAt: Date | null;
};

type PerformanceWorkflowTaskRecord = {
  id: string;
  instanceId: string;
  stepId: string;
  stepOrder: number;
  attemptNo: number;
  stepName: string;
  stepType: PerformanceWorkflowStepType;
  stepSnapshot: Prisma.JsonValue;
  rejectionStrategy: PerformanceWorkflowRejectionStrategy | null;
  rejectionTargetStepId: string | null;
  status: TaskStatus;
  executorNameSnapshot: string | null;
  completedAt: Date | null;
  assignees?: PerformanceWorkflowTaskAssigneeRecord[];
  instance?: {
    currentWorkflowOrder: number | null;
    employeeId: string;
    finalScore: Prisma.Decimal | null;
    actualAmount: Prisma.Decimal | null;
    cycle: { name: string };
    employee: { name: string | null; employeeNo: string };
  };
};

type PerformanceTaskRecord = {
  id: string;
  instanceId: string;
  employeeId: string;
  moduleId: string;
  moduleOrder: number;
  moduleName: string;
  moduleType: PerformanceModuleType;
  moduleWeight: Prisma.Decimal | null;
  moduleSnapshot: Prisma.JsonValue;
  executorType: PerformanceExecutorType;
  executionMode: PerformanceExecutionMode;
  executorUserId: string | null;
  executorDirectoryType: PerformanceDirectoryType | null;
  executorDirectoryId: string | null;
  executorNameSnapshot: string | null;
  executorAccountSnapshot: string | null;
  executorResolvedAt: Date | null;
  assignees?: PerformanceTaskAssigneeRecord[];
  status: TaskStatus;
  rawData: Prisma.JsonValue | null;
  calculationDetails: Prisma.JsonValue | null;
  submission: Prisma.JsonValue | null;
  moduleScore: Prisma.Decimal | null;
  completedAt: Date | null;
  instance?: {
    cycle: { periodStart: Date };
    currentModuleOrder: number | null;
    assessmentStatus?: ProcessStatus;
    tasks: PerformanceTaskRecord[];
  };
};

@Injectable()
export class PerformanceService {
  private readonly adapter: PerformanceDataAdapter;
  private readonly inboxNotifications = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly audit: AuditService,
    private readonly demo: DemoDataService,
    private readonly parser: PerformanceTemplateParser,
    private readonly rules: PerformanceRuleEngine,
    @Inject(PERFORMANCE_DATA_ADAPTER) adapter: PerformanceDataAdapter,
    private readonly feishu: FeishuService,
    feishuLongConnection?: FeishuLongConnectionService,
    private readonly feishuTaskSessions?: FeishuTaskSessionService,
  ) {
    this.adapter = adapter;
    feishuLongConnection?.registerCardActionHandler((event) => this.handleLongConnectionCardAction(event.payload, event.eventId));
  }

  parseTemplate(dto: ParsePerformanceTemplateDto) {
    this.assertDatabaseMode();
    return this.parser.parse(dto.sourceMarkdown, dto.sourceName ?? null);
  }

  async listTemplates(_user: AuthenticatedUser) {
    this.assertDatabaseMode();
    const rows = await this.prisma.performanceTemplate.findMany({
      where: { status: RecordStatus.ACTIVE, archivedAt: null },
      include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.presentTemplate(row));
  }

  async getTemplate(id: string) {
    this.assertDatabaseMode();
    const row = await this.prisma.performanceTemplate.findFirst({
      where: { id, status: RecordStatus.ACTIVE, archivedAt: null },
      include: { versions: { orderBy: { versionNo: 'desc' } } },
    });
    if (!row) throw new NotFoundException('绩效模板不存在');
    return this.presentTemplateDetail(row);
  }

  async createTemplate(user: AuthenticatedUser, dto: CreatePerformanceTemplateDto) {
    this.assertDatabaseMode();
    const definition = this.assertTemplatePayload(dto);
    await this.assertExecutorUserScope(user, definition);
    const row = await this.prisma.$transaction(async (tx) => {
      const template = await tx.performanceTemplate.create({
        data: { name: dto.name.trim(), description: dto.description?.trim() || null, createdById: user.id },
      });
      await tx.performanceTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNo: 1,
          sourceType: dto.sourceType,
          sourceName: dto.sourceType === PerformanceTemplateSourceType.MARKDOWN ? dto.sourceName?.trim() || null : null,
          sourceMarkdown: dto.sourceType === PerformanceTemplateSourceType.MARKDOWN ? dto.sourceMarkdown ?? null : null,
          definition: definition as unknown as Prisma.InputJsonValue,
          status: PerformanceVersionStatus.PUBLISHED,
          publishedAt: new Date(),
          createdById: user.id,
        },
      });
      await this.audit.create({ userId: user.id }, AuditAction.CREATE, template.id, { resource: 'performance-template', versionNo: 1 }, tx, 'performance_template');
      return tx.performanceTemplate.findUniqueOrThrow({ where: { id: template.id }, include: { versions: true } });
    });
    return this.presentTemplateDetail(row);
  }

  async copyTemplate(user: AuthenticatedUser, sourceTemplateId: string) {
    this.assertDatabaseMode();
    const source = await this.prisma.performanceTemplate.findFirst({
      where: { id: sourceTemplateId, status: RecordStatus.ACTIVE, archivedAt: null },
      include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
    });
    const sourceVersion = source?.versions[0];
    if (!source || !sourceVersion) throw new NotFoundException('绩效模板不存在或没有可复制的版本');
    const copied = await this.prisma.$transaction(async (tx) => {
      const template = await tx.performanceTemplate.create({
        data: {
          name: `${source.name} 副本`,
          description: source.description,
          createdById: user.id,
        },
      });
      await tx.performanceTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNo: 1,
          sourceType: sourceVersion.sourceType,
          sourceName: sourceVersion.sourceName,
          sourceMarkdown: sourceVersion.sourceMarkdown,
          definition: sourceVersion.definition as Prisma.InputJsonValue,
          status: PerformanceVersionStatus.DRAFT,
          createdById: user.id,
        },
      });
      await this.audit.create({ userId: user.id }, AuditAction.CREATE, template.id, { resource: 'performance-template', action: 'copy', sourceTemplateId, sourceVersionId: sourceVersion.id }, tx, 'performance_template');
      return tx.performanceTemplate.findUniqueOrThrow({ where: { id: template.id }, include: { versions: { orderBy: { versionNo: 'desc' } } } });
    });
    return { ...this.presentTemplateDetail(copied), sourceTemplateId };
  }

  async archiveTemplate(user: AuthenticatedUser, templateId: string, dto: ArchivePerformanceTemplateDto) {
    this.assertDatabaseMode();
    const template = await this.prisma.performanceTemplate.findFirst({ where: { id: templateId, status: RecordStatus.ACTIVE, archivedAt: null } });
    if (!template) throw new NotFoundException('绩效模板不存在或已归档');
    const archived = await this.prisma.$transaction(async (tx) => {
      const row = await tx.performanceTemplate.update({
        where: { id: templateId },
        data: {
          status: RecordStatus.ARCHIVED,
          archivedAt: new Date(),
          archivedById: user.id,
          archiveReason: dto.reason?.trim() || '用户从绩效模板列表归档',
        },
        include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
      });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, templateId, { resource: 'performance-template', action: 'archive', reason: row.archiveReason }, tx, 'performance_template');
      return row;
    });
    return this.presentTemplate(archived);
  }

  async createTemplateVersion(user: AuthenticatedUser, templateId: string, dto: CreatePerformanceTemplateDto) {
    this.assertDatabaseMode();
    const template = await this.prisma.performanceTemplate.findFirst({ where: { id: templateId, status: RecordStatus.ACTIVE, archivedAt: null } });
    if (!template) throw new NotFoundException('绩效模板不存在');
    const definition = this.assertTemplatePayload(dto);
    await this.assertExecutorUserScope(user, definition);
    const latest = await this.prisma.performanceTemplateVersion.findFirst({ where: { templateId }, orderBy: { versionNo: 'desc' } });
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.performanceTemplateVersion.updateMany({
        where: { templateId, status: PerformanceVersionStatus.PUBLISHED },
        data: { status: PerformanceVersionStatus.ARCHIVED },
      });
      const version = await tx.performanceTemplateVersion.create({
        data: {
          templateId,
          versionNo: (latest?.versionNo ?? 0) + 1,
          sourceType: dto.sourceType,
          sourceName: dto.sourceType === PerformanceTemplateSourceType.MARKDOWN ? dto.sourceName?.trim() || null : null,
          sourceMarkdown: dto.sourceType === PerformanceTemplateSourceType.MARKDOWN ? dto.sourceMarkdown ?? null : null,
          definition: definition as unknown as Prisma.InputJsonValue,
          status: PerformanceVersionStatus.PUBLISHED,
          publishedAt: new Date(),
          createdById: user.id,
        },
      });
      await tx.performanceTemplate.update({ where: { id: templateId }, data: { name: dto.name.trim(), description: dto.description?.trim() || null } });
      await this.audit.create({ userId: user.id }, AuditAction.CREATE, version.id, { resource: 'performance-template-version', templateId, versionNo: version.versionNo, action: 'save-and-publish' }, tx, 'performance_template_version');
      return version;
    });
    return this.presentVersion(row);
  }

  async publishTemplateVersion(user: AuthenticatedUser, templateId: string, versionId: string) {
    this.assertDatabaseMode();
    const version = await this.prisma.performanceTemplateVersion.findFirst({ where: { id: versionId, templateId } });
    if (!version) throw new NotFoundException('绩效模板版本不存在');
    const definition = this.parser.assertValidDefinition(version.definition, true);
    await this.assertExecutorUserScope(user, definition);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.performanceTemplateVersion.updateMany({ where: { templateId, status: PerformanceVersionStatus.PUBLISHED }, data: { status: PerformanceVersionStatus.ARCHIVED } });
      const published = await tx.performanceTemplateVersion.update({ where: { id: versionId }, data: { status: PerformanceVersionStatus.PUBLISHED, publishedAt: new Date() } });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, versionId, { resource: 'performance-template-version', action: 'publish' }, tx, 'performance_template_version');
      return published;
    });
    return this.presentVersion(result);
  }

  async getOptions(user: AuthenticatedUser) {
    this.assertDatabaseMode();
    const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user);
    const now = new Date();
    const currentAssignmentWhere: Prisma.EmployeeAssignmentWhereInput = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      isPrimary: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      ...(accessibleOrganizationIds === null ? {} : { organizationId: { in: accessibleOrganizationIds } }),
    };
    const [users, positions, jobTitles] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: {
          status: RecordStatus.ACTIVE,
          archivedAt: null,
          employee: {
            recordStatus: RecordStatus.ACTIVE,
            archivedAt: null,
            assignments: { some: currentAssignmentWhere },
          },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          employee: {
            select: {
              id: true,
              employeeNo: true,
              assignments: {
                where: currentAssignmentWhere,
                select: { organizationId: true, organization: { select: { name: true } } },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.position.findMany({ where: { status: RecordStatus.ACTIVE, archivedAt: null }, select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      this.prisma.jobTitle.findMany({ where: { status: RecordStatus.ACTIVE, archivedAt: null }, select: { id: true, code: true, name: true }, orderBy: [{ name: 'asc' }, { code: 'asc' }] }),
    ]);
    return {
      users: users.flatMap((item) => {
        const assignment = item.employee?.assignments[0];
        if (!item.employee || !assignment) return [];
        return [{
          id: item.id,
          username: item.username,
          displayName: item.displayName,
          employeeId: item.employee.id,
          employeeNo: item.employee.employeeNo,
          organizationId: assignment.organizationId,
          organizationName: assignment.organization.name,
        }];
      }),
      positions,
      jobTitles,
    };
  }

  async createCycle(user: AuthenticatedUser, dto: CreatePerformanceCycleDto) {
    this.assertDatabaseMode();
    const version = dto.templateVersionId
      ? await this.prisma.performanceTemplateVersion.findFirst({
          where: { id: dto.templateVersionId, status: PerformanceVersionStatus.PUBLISHED },
          include: { template: true },
        })
      : null;
    if (dto.templateVersionId && !version) throw new BadRequestException('只能使用已发布的绩效模板版本');
    const definition = version ? this.parser.assertValidDefinition(version.definition, true) : null;
    const start = this.parseDate(dto.periodStart);
    const end = this.parseDate(dto.periodEnd);
    if (end < start) throw new BadRequestException('绩效周期结束日期不能早于开始日期');
    if (start.getUTCFullYear() !== dto.year || end.getUTCFullYear() !== dto.year) throw new BadRequestException('活动开始和结束时间必须属于所选年度');

    await this.access.assertOrganizationAccess(user, dto.organizationId);
    const accessible = await this.access.getAccessibleOrganizationIds(user);
    const organizationIds = await this.access.getOrganizationSubtreeIds(dto.organizationId, accessible ?? undefined);
    if (organizationIds.length === 0) throw new ForbiddenException('所选组织不在当前账号的数据范围内或已停用');
    const employees = await this.prisma.employee.findMany({
      where: {
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        assignments: {
          some: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            isPrimary: true,
            organizationId: { in: organizationIds },
            startDate: { lte: start },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
          },
        },
      },
      select: {
        id: true,
        assignments: {
          where: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            isPrimary: true,
            organizationId: { in: organizationIds },
            startDate: { lte: start },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
          },
          select: { organizationId: true },
          take: 1,
        },
      },
      orderBy: { employeeNo: 'asc' },
    });
    if (version && employees.length === 0) throw new BadRequestException('所选组织及下级组织在活动开始日没有可参与的有效员工');
    if (dto.employeeIds && (dto.employeeIds.length !== employees.length || dto.employeeIds.some((id) => !employees.some((employee) => employee.id === id)))) {
      throw new BadRequestException('绩效活动参与人员由所属组织及下级组织自动计算，不能由客户端修改');
    }

    let exceptionHandler: { id: string } | null = null;
    if (dto.exceptionHandlerType === PerformanceExceptionHandlerType.SPECIFIED_USER) {
      if (!dto.exceptionHandlerEmployeeId) throw new BadRequestException('指定异常处理人时必须选择在职员工');
      exceptionHandler = await this.findAccessibleExceptionHandler(user, dto.exceptionHandlerEmployeeId);
      if (!exceptionHandler) throw new ForbiddenException('指定异常处理人不在当前账号数据范围内或没有有效主要任职');
    } else if (dto.exceptionHandlerEmployeeId) {
      throw new BadRequestException('直属经理类型不能指定异常处理人');
    }

    const preparedInstances = employees.map((employee) => {
      const employeeAssignment = employee.assignments[0];
      if (!employeeAssignment) throw new BadRequestException(`员工 ${employee.id} 在绩效周期开始日没有有效主要任职`);
      return {
        id: randomUUID(),
        employeeId: employee.id,
        organizationId: employeeAssignment.organizationId,
      };
    });
    const preparedTasks = definition ? preparedInstances.flatMap((instance) => this.buildModuleTaskRows(instance, definition)) : [];
    const cycle = await this.prisma.$transaction(async (tx) => {
      const created = await tx.performanceCycle.create({
        data: {
          name: dto.name.trim(),
          organizationId: dto.organizationId,
          isPublic: dto.isPublic,
          linkedLevel: dto.linkedLevel,
          year: dto.year,
          periodType: dto.periodType,
          exceptionHandlerType: dto.exceptionHandlerType,
          exceptionHandlerEmployeeId: exceptionHandler?.id ?? null,
          lockRelation: dto.lockRelation,
          periodStart: start,
          periodEnd: end,
          templateId: version?.templateId ?? null,
          templateVersionId: version?.id ?? null,
          createdById: user.id,
        },
      });
      await tx.performanceInstance.createMany({
        data: preparedInstances.map((instance) => ({
          id: instance.id,
          cycleId: created.id,
          employeeId: instance.employeeId,
          organizationId: instance.organizationId,
          sourceMarkdown: version?.sourceMarkdown ?? '',
          definitionSnapshot: (definition ?? { schemaVersion: 1, name: '', modules: [] }) as unknown as Prisma.InputJsonValue,
        })),
      });
      if (preparedTasks.length > 0) await tx.performanceModuleTask.createMany({ data: preparedTasks });
      await this.audit.create({ userId: user.id }, AuditAction.CREATE, created.id, { resource: 'performance-cycle', organizationId: dto.organizationId, employeeCount: employees.length, periodType: dto.periodType, exceptionHandlerType: dto.exceptionHandlerType, lockRelation: dto.lockRelation }, tx, 'performance_cycle');
      return tx.performanceCycle.findUniqueOrThrow({
        where: { id: created.id },
        include: this.cycleInclude({ includeTemplateVersion: false }),
      });
    }, { maxWait: 10_000, timeout: 30_000 });
    return this.presentCycle(cycle);
  }

  async restartCycle(user: AuthenticatedUser, cycleId: string, dto: PerformanceCycleParticipantsActionDto) {
    this.assertDatabaseMode();
    const employeeIds = [...new Set(dto.employeeIds)];
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: cycleId }, include: { instances: { where: { employeeId: { in: employeeIds } }, include: { tasks: true, workflowTasks: true } } } });
    if (!cycle) throw new NotFoundException('绩效活动不存在');
    await this.assertCycleScope(user, cycle.instances, cycle.organizationId);
    if (cycle.status === ProcessStatus.COMPLETED || cycle.status === ProcessStatus.CANCELLED) throw new ConflictException('已结束或已关闭的绩效活动不能重启');
    if (cycle.instances.length !== employeeIds.length) throw new NotFoundException('部分被考核人不在当前活动中');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceModuleTask.updateMany({ where: { instance: { cycleId, employeeId: { in: employeeIds } }, status: { not: TaskStatus.COMPLETED } }, data: { status: TaskStatus.PENDING, completedAt: null, moduleScore: null, submission: Prisma.DbNull, rawData: Prisma.DbNull, calculationDetails: Prisma.DbNull } });
      await tx.performanceWorkflowTask.updateMany({ where: { instance: { cycleId, employeeId: { in: employeeIds } }, status: { not: TaskStatus.COMPLETED } }, data: { status: TaskStatus.PENDING, completedAt: null } });
      await tx.performanceInstance.updateMany({ where: { cycleId, employeeId: { in: employeeIds } }, data: { status: ProcessStatus.IN_PROGRESS, assessmentStatus: ProcessStatus.IN_PROGRESS, finalScore: null, fixedWeightedScore: null, adjustmentScore: 0, rawFinalScore: null, actualAmount: null, employeeAmountBaseId: null, employeeAmountBaseSnapshot: null, employeeAmountBaseVersionNo: null, calculationFormula: null, currentModuleOrder: null, currentWorkflowOrder: null, workflowCompletedAt: null } });
      await tx.performanceCycle.update({ where: { id: cycleId }, data: { status: ProcessStatus.IN_PROGRESS, startedAt: now, completedAt: null } });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, cycleId, { resource: 'performance-cycle', action: 'restart', employeeIds }, tx, 'performance_cycle');
    });
    return this.startCycle(user, cycleId);
  }

  async closeCycleParticipants(user: AuthenticatedUser, cycleId: string, dto: PerformanceCycleParticipantsActionDto) {
    this.assertDatabaseMode();
    const employeeIds = [...new Set(dto.employeeIds)];
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: cycleId }, include: { instances: { select: { employeeId: true, organizationId: true } } } });
    if (!cycle) throw new NotFoundException('绩效活动不存在');
    await this.assertCycleScope(user, cycle.instances, cycle.organizationId);
    const existing = new Set(cycle.instances.map((instance) => instance.employeeId));
    if (employeeIds.some((employeeId) => !existing.has(employeeId))) throw new NotFoundException('部分被考核人不在当前活动中');
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceWorkflowTask.updateMany({ where: { instance: { cycleId, employeeId: { in: employeeIds } }, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } }, data: { status: TaskStatus.CANCELLED } });
      await tx.performanceModuleTask.updateMany({ where: { instance: { cycleId, employeeId: { in: employeeIds } }, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } }, data: { status: TaskStatus.CANCELLED } });
      await tx.performanceInstance.updateMany({ where: { cycleId, employeeId: { in: employeeIds } }, data: { status: ProcessStatus.CANCELLED } });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, cycleId, { resource: 'performance-cycle-participant', action: 'close', employeeIds }, tx, 'performance_cycle_participant');
    });
    return this.getCycle(cycleId, user);
  }

  async archiveCycle(user: AuthenticatedUser, cycleId: string, dto: ArchivePerformanceCycleDto) {
    this.assertDatabaseMode();
    const cycle = await this.prisma.performanceCycle.findUnique({
      where: { id: cycleId },
      include: { instances: { select: { organizationId: true } } },
    });
    if (!cycle) throw new NotFoundException('绩效活动不存在');
    await this.assertCycleScope(user, cycle.instances, cycle.organizationId);
    if (cycle.archivedAt) throw new ConflictException('绩效活动已归档');
    const archived = await this.prisma.$transaction(async (tx) => {
      const row = await tx.performanceCycle.update({
        where: { id: cycleId },
        data: {
          archivedAt: new Date(),
          archivedById: user.id,
          archiveReason: dto.reason?.trim() || '用户从绩效活动列表归档',
          status: cycle.status === ProcessStatus.IN_PROGRESS ? ProcessStatus.CANCELLED : cycle.status,
          ...(cycle.status === ProcessStatus.IN_PROGRESS ? { completedAt: new Date() } : {}),
        },
        include: this.cycleInclude(),
      });
      if (cycle.status === ProcessStatus.IN_PROGRESS) {
        await tx.performanceInstance.updateMany({
          where: { cycleId, status: ProcessStatus.IN_PROGRESS },
          data: { status: ProcessStatus.CANCELLED },
        });
        await tx.performanceModuleTask.updateMany({
          where: { instance: { cycleId }, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } },
          data: { status: TaskStatus.CANCELLED },
        });
        await tx.performanceWorkflowTask.updateMany({
          where: { instance: { cycleId }, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } },
          data: { status: TaskStatus.CANCELLED },
        });
      }
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, cycleId, { resource: 'performance-cycle', action: 'archive', reason: dto.reason?.trim() || null }, tx, 'performance_cycle');
      return row;
    });
    return this.presentCycle(archived);
  }

  async startCycle(user: AuthenticatedUser, cycleId: string) {
    this.assertDatabaseMode();
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: cycleId }, include: { instances: true } });
    if (!cycle) throw new NotFoundException('绩效周期不存在');
    await this.assertCycleScope(user, cycle.instances, cycle.organizationId);
    if (cycle.status !== ProcessStatus.DRAFT) throw new BadRequestException('只有草稿周期可以启动');
    const activeInstances = cycle.instances.filter((instance) => instance.status !== ProcessStatus.CANCELLED);
    if (activeInstances.length === 0) {
      throw new BadRequestException('缺少模板：活动中没有可启动的被考核人');
    }
    const tasks = await this.prisma.performanceModuleTask.findMany({
      where: { instanceId: { in: activeInstances.map((instance) => instance.id) } },
      orderBy: [{ instanceId: 'asc' }, { moduleOrder: 'asc' }],
    });
    if (tasks.length === 0) throw new BadRequestException('缺少模板：请先为活动人员配置绩效模板后再启动');
    const missingTaskInstanceIds = activeInstances
      .map((instance) => instance.id)
      .filter((instanceId) => !tasks.some((task) => task.instanceId === instanceId));
    if (missingTaskInstanceIds.length > 0) throw new BadRequestException('缺少模板：部分被考核人尚未配置绩效模板，无法开启绩效');
    // Only the employees already included in this activity are relevant here.
    // `employeeAmountBaseId` is a final-result snapshot and is intentionally
    // null before completion, so it must not be used as a configuration check.
    const participantEmployeeIds = [...new Set(activeInstances.map((instance) => instance.employeeId))];
    const configuredAmountBases = await this.prisma.employeePerformanceAmountBase.findMany({
      where: { employeeId: { in: participantEmployeeIds }, replacedAt: null },
      select: { employeeId: true },
    });
    const configuredEmployeeIds = new Set(configuredAmountBases.map((amountBase) => amountBase.employeeId));
    const missingAmountBaseEmployeeIds = participantEmployeeIds.filter((employeeId) => !configuredEmployeeIds.has(employeeId));
    if (missingAmountBaseEmployeeIds.length > 0) {
      throw new BadRequestException('缺少金额基数：当前活动中部分被考核人尚未配置个人金额基数，无法开启绩效');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceCycle.update({ where: { id: cycleId }, data: { status: ProcessStatus.IN_PROGRESS, startedAt: new Date() } });
      for (const instance of activeInstances) {
        const firstManualAssessment = tasks.find((task) => task.instanceId === instance.id
          && task.status === TaskStatus.PENDING
          && task.moduleType !== PerformanceModuleType.METRIC
          && (task.moduleSnapshot as { enabled?: boolean }).enabled !== false);
        await tx.performanceInstance.update({
          where: { id: instance.id },
          data: {
            status: ProcessStatus.IN_PROGRESS,
            assessmentStatus: ProcessStatus.IN_PROGRESS,
            currentModuleOrder: firstManualAssessment?.moduleOrder ?? null,
          },
        });
        if (firstManualAssessment) {
          await tx.performanceModuleTask.update({ where: { id: firstManualAssessment.id, status: TaskStatus.PENDING }, data: { status: TaskStatus.IN_PROGRESS } });
        }
      }
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, cycleId, { resource: 'performance-cycle', action: 'start' }, tx, 'performance_cycle');
    });

    // Metrics are assessment data rather than workflow nodes. Calculate all
    // enabled metrics up front, then open only evaluation and adjustment tasks.
    // An activity without a template intentionally has neither type of task.
    for (const instance of activeInstances) {
      const instanceTasks = tasks.filter((task) => task.instanceId === instance.id);
      for (const task of instanceTasks) {
        if (task.moduleType === PerformanceModuleType.METRIC && (task.moduleSnapshot as { enabled?: boolean }).enabled !== false) {
          await this.executeMetricTask(task as PerformanceTaskRecord, cycle.periodStart, cycle.periodEnd);
        }
      }
      if (instanceTasks.length > 0) await this.advanceAssessment(instance.id, user);
    }
    return this.getCycle(cycleId, user);
  }

  async listCycles(user: AuthenticatedUser, query: QueryPerformanceDto) {
    this.assertDatabaseMode();
    const scope = await this.access.getAccessibleOrganizationIds(user);
    const where: Prisma.PerformanceCycleWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(scope === null ? {} : { OR: [{ organizationId: { in: scope } }, { organizationId: null, instances: { some: { organizationId: { in: scope } } } }] }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.performanceCycle.findMany({ where, include: this.cycleInclude(), orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.performanceCycle.count({ where }),
    ]);
    return { data: rows.map((row) => this.presentCycle(row)), meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async getCycle(id: string, user?: AuthenticatedUser) {
    this.assertDatabaseMode();
    const row = await this.prisma.performanceCycle.findUnique({
      where: { id },
      include: {
        ...this.cycleInclude(),
        instances: {
          include: {
            organization: { select: { name: true } },
            employee: {
              select: {
                name: true,
                employeeNo: true,
                employmentPeriods: {
                  where: { status: RecordStatus.ACTIVE, archivedAt: null },
                  orderBy: { sequenceNo: 'desc' },
                  take: 1,
                  select: { employmentStatus: true },
                },
                performanceAmountBases: {
                  where: { replacedAt: null },
                  select: { id: true },
                  take: 1,
                },
              },
            },
            tasks: {
              orderBy: { moduleOrder: 'asc' },
              include: {
                assignees: {
                  orderBy: { createdAt: 'asc' },
                  select: { displayNameSnapshot: true },
                },
              },
            },
            workflowTasks: {
              where: { status: TaskStatus.IN_PROGRESS },
              orderBy: [{ stepOrder: 'asc' }, { attemptNo: 'desc' }],
              include: {
                assignees: {
                  orderBy: { createdAt: 'asc' },
                  select: { displayNameSnapshot: true },
                },
              },
              take: 1,
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('绩效周期不存在');
    if (user) {
      await this.assertCycleScope(user, row.instances, row.organizationId);
      await this.audit.create(
        { userId: user.id },
        AuditAction.DETAIL_VIEW,
        row.id,
        { resource: 'performance-cycle' },
        this.prisma,
        'performance_cycle',
      );
    }
    return {
      ...this.presentCycle(row),
      instances: row.instances.map((instance) => {
        const currentAssessmentTask = instance.tasks.find((task) => task.moduleOrder === instance.currentModuleOrder) ?? null;
        const currentWorkflowTask = instance.workflowTasks[0] ?? null;
        const currentTask = currentWorkflowTask ?? currentAssessmentTask;
        const finalScore = this.number(instance.finalScore);
        const executorNames = currentTask?.assignees.map((assignee) => assignee.displayNameSnapshot).filter(Boolean) ?? [];
        return {
          id: instance.id,
          employeeAmountBaseConfigured: instance.employee.performanceAmountBases.length > 0,
          employeeAmountBaseAmount: this.number(instance.employeeAmountBaseSnapshot),
          employeeId: instance.employeeId,
          employeeName: instance.employee.name ?? '',
          employeeNo: instance.employee.employeeNo,
          organizationName: instance.organization?.name ?? row.organization?.name ?? null,
          templateName: this.templateNameFromDefinition(instance.definitionSnapshot),
          indicatorTemplateName: null,
          currentStepName: currentWorkflowTask?.stepName ?? currentAssessmentTask?.moduleName ?? null,
          currentStepKind: currentWorkflowTask ? 'WORKFLOW' : currentAssessmentTask ? 'ASSESSMENT' : null,
          currentExecutorName: executorNames.length > 0 ? executorNames.join('、') : currentTask?.executorNameSnapshot ?? null,
          assessmentGroupName: null,
          assessmentStatus: instance.assessmentStatus ?? (instance.status === ProcessStatus.COMPLETED ? ProcessStatus.COMPLETED : ProcessStatus.DRAFT),
          assessmentCompletedAt: instance.assessmentCompletedAt?.toISOString() ?? null,
          workflowCompletedAt: instance.workflowCompletedAt?.toISOString() ?? null,
          status: instance.status,
          finalScore,
          finalGrade: null,
          employmentStatus: instance.employee.employmentPeriods[0]?.employmentStatus ?? null,
          finalCoefficient: finalScore === null ? null : Math.round((finalScore / 100) * 1000) / 1000,
          actualAmount: this.number(instance.actualAmount),
        };
      }),
    };
  }

  async getParticipantWorkflow(user: AuthenticatedUser, cycleId: string, instanceId: string) {
    this.assertDatabaseMode();
    const instance = await this.prisma.performanceInstance.findFirst({
      where: { id: instanceId, cycleId, cycle: { archivedAt: null } },
      include: {
        cycle: {
          include: {
            template: { select: { name: true } },
            templateVersion: { select: { versionNo: true } },
          },
        },
        employee: { select: { id: true, name: true, employeeNo: true } },
        tasks: {
          where: { moduleType: { in: [PerformanceModuleType.EVALUATION, PerformanceModuleType.ADJUSTMENT] } },
          orderBy: { moduleOrder: 'asc' },
          include: {
            assignees: {
              orderBy: { createdAt: 'asc' },
              include: { notificationDeliveries: { orderBy: { createdAt: 'asc' } } },
            },
          },
        },
        workflowTasks: {
          orderBy: [{ stepOrder: 'asc' }, { attemptNo: 'asc' }],
          include: {
            assignees: {
              orderBy: { createdAt: 'asc' },
              include: { notificationDeliveries: { orderBy: { createdAt: 'asc' } } },
            },
          },
        },
      },
    });
    if (!instance) throw new NotFoundException('被考核人不存在或不在当前活动中');
    await this.assertCycleScope(user, [{ organizationId: instance.organizationId }], instance.cycle.organizationId);
    await this.audit.create(
      { userId: user.id },
      AuditAction.DETAIL_VIEW,
      instance.id,
      { resource: 'performance-participant-workflow', cycleId },
      this.prisma,
      'performance_participant_workflow',
    );

    const assessmentSteps = instance.tasks.map((task) => this.presentAssessmentFlowStep(task));
    const workflowSteps = instance.workflowTasks.map((task) => this.presentWorkflowFlowStep(task));
    return {
      cycleId: instance.cycleId,
      cycleName: instance.cycle.name,
      instanceId: instance.id,
      employeeId: instance.employee.id,
      employeeName: instance.employee.name ?? '',
      employeeNo: instance.employee.employeeNo,
      templateName: this.templateNameFromDefinition(instance.definitionSnapshot),
      templateVersionNo: null,
      steps: [...assessmentSteps, ...workflowSteps],
    };
  }

  async getParticipantAssessmentDetail(user: AuthenticatedUser, cycleId: string, instanceId: string) {
    this.assertDatabaseMode();
    const instance = await this.prisma.performanceInstance.findFirst({
      where: { id: instanceId, cycleId },
      include: {
        cycle: {
          include: {
            template: { select: { name: true } },
            templateVersion: { select: { versionNo: true } },
          },
        },
        employee: { select: { id: true, name: true, employeeNo: true } },
        tasks: {
          orderBy: { moduleOrder: 'asc' },
          include: { assignees: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    if (!instance) throw new NotFoundException('被考核人不存在或不在当前活动中');
    await this.assertCycleScope(user, [{ organizationId: instance.organizationId }], instance.cycle.organizationId);
    await this.audit.create(
      { userId: user.id },
      AuditAction.DETAIL_VIEW,
      instance.id,
      { resource: 'performance-participant-assessment-detail', cycleId },
      this.prisma,
      'performance_participant_assessment_detail',
    );

    const modules = instance.tasks.map((task) => this.presentAssessmentDetailModule(task));
    const finalScore = this.number(instance.finalScore);
    const baseSnapshot = this.number(instance.employeeAmountBaseSnapshot);
    const archived = Boolean(instance.cycle.archivedAt);
    const calculationStatus = archived && finalScore !== null
      ? 'ARCHIVED_SNAPSHOT'
      : finalScore === null
        ? 'NOT_READY'
        : baseSnapshot === null
          ? 'NO_AMOUNT_BASE'
          : 'CALCULATED';
    const emptyReason = calculationStatus === 'NOT_READY'
      ? '考核尚未完成，暂未生成最终得分和金额。'
      : calculationStatus === 'NO_AMOUNT_BASE'
        ? '尚未配置或冻结员工个人绩效金额基数。'
        : null;
    return {
      cycleId: instance.cycleId,
      cycleName: instance.cycle.name,
      instanceId: instance.id,
      employeeId: instance.employee.id,
      employeeName: instance.employee.name ?? '',
      employeeNo: instance.employee.employeeNo,
      templateName: instance.cycle.template?.name ?? this.templateNameFromDefinition(instance.definitionSnapshot),
      templateVersionNo: instance.cycle.templateVersion?.versionNo ?? null,
      activityStatus: instance.cycle.status,
      instanceStatus: instance.status,
      archived,
      modules,
      fixedWeightedScore: this.number(instance.fixedWeightedScore),
      adjustmentScore: this.number(instance.adjustmentScore),
      finalScore,
      finalCoefficient: finalScore === null ? null : this.round(finalScore / 100, 4),
      employeeAmountBaseId: instance.employeeAmountBaseId ?? null,
      employeeAmountBaseVersionNo: instance.employeeAmountBaseVersionNo ?? null,
      employeeAmountBaseSnapshot: baseSnapshot,
      calculationFormula: instance.calculationFormula ?? null,
      actualAmount: this.number(instance.actualAmount),
      calculationStatus,
      emptyReason,
    };
  }

  async addCycleParticipants(user: AuthenticatedUser, cycleId: string, dto: AddPerformanceCycleParticipantsDto) {
    this.assertDatabaseMode();
    const employeeIds = [dto.employeeId];

    const cycle = await this.prisma.performanceCycle.findUnique({
      where: { id: cycleId },
      include: {
        templateVersion: true,
        instances: { select: { id: true, employeeId: true, organizationId: true } },
      },
    });
    if (!cycle) throw new NotFoundException('绩效周期不存在');
    await this.assertCycleScope(user, cycle.instances, cycle.organizationId);
    if (cycle.status !== ProcessStatus.DRAFT && cycle.status !== ProcessStatus.IN_PROGRESS) {
      throw new BadRequestException('只有草稿或进行中的绩效活动可以添加被考核人');
    }
    const templateVersion = await this.prisma.performanceTemplateVersion.findFirst({
      where: { id: dto.templateVersionId, status: PerformanceVersionStatus.PUBLISHED },
      include: { template: true },
    });
    if (!templateVersion) throw new BadRequestException('请选择已发布绩效模板');

    const definition = this.parser.assertValidDefinition(templateVersion.definition, true);
    const firstModuleOrder = definition.modules.findIndex((module) => module.enabled !== false && module.type !== PerformanceModuleType.METRIC);
    if (definition.modules.every((module) => module.enabled === false)) throw new BadRequestException('绩效模板没有启用的考核模块');

    const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user);
    const employeeAssignmentsWhere = {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      isPrimary: true,
      startDate: { lte: cycle.periodStart },
      OR: [{ endDate: null }, { endDate: { gte: cycle.periodStart } }],
      ...(accessibleOrganizationIds === null ? {} : { organizationId: { in: accessibleOrganizationIds } }),
    };
    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        assignments: { some: employeeAssignmentsWhere },
      },
      select: {
        id: true,
        assignments: {
          where: employeeAssignmentsWhere,
          select: { organizationId: true },
          take: 1,
        },
      },
    });
    if (employees.length !== employeeIds.length) {
      throw new ForbiddenException('所选人员不在当前账号数据范围内，或在活动开始日没有有效主要任职');
    }

    const existingEmployeeIds = new Set(cycle.instances.map((instance) => instance.employeeId));
    if (employeeIds.some((employeeId) => existingEmployeeIds.has(employeeId))) {
      throw new ConflictException('所选人员中存在已加入该活动的被考核人');
    }

    const preparedInstances = employees.map((employee) => {
      const assignment = employee.assignments[0];
      if (!assignment) throw new BadRequestException(`员工 ${employee.id} 在活动开始日没有有效主要任职`);
      return {
        id: randomUUID(),
        employeeId: employee.id,
        organizationId: assignment.organizationId,
      };
    });
    const preparedTasks = preparedInstances.flatMap((instance) => this.buildModuleTaskRows(instance, definition, {
      status: cycle.status === ProcessStatus.IN_PROGRESS ? TaskStatus.PENDING : TaskStatus.PENDING,
    }));
    const instanceIds = preparedInstances.map((instance) => instance.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceInstance.createMany({
        data: preparedInstances.map((instance) => ({
          id: instance.id,
          cycleId,
          employeeId: instance.employeeId,
          organizationId: instance.organizationId,
          sourceMarkdown: templateVersion.sourceMarkdown ?? '',
          definitionSnapshot: definition as unknown as Prisma.InputJsonValue,
          status: cycle.status === ProcessStatus.IN_PROGRESS ? ProcessStatus.IN_PROGRESS : ProcessStatus.DRAFT,
          assessmentStatus: cycle.status === ProcessStatus.IN_PROGRESS ? ProcessStatus.IN_PROGRESS : ProcessStatus.DRAFT,
          currentModuleOrder: cycle.status === ProcessStatus.IN_PROGRESS && firstModuleOrder >= 0 ? firstModuleOrder : null,
        })),
      });
      await tx.performanceModuleTask.createMany({ data: preparedTasks });
      await this.audit.create(
        { userId: user.id },
        AuditAction.CREATE,
        cycleId,
        { resource: 'performance-cycle-participant', employeeIds, templateVersionId: templateVersion.id, count: employeeIds.length },
        tx,
        'performance_cycle_participant',
      );
    }, { maxWait: 10_000, timeout: 30_000 });

    if (cycle.status === ProcessStatus.IN_PROGRESS) {
      const createdTasks = await this.prisma.performanceModuleTask.findMany({ where: { instanceId: { in: instanceIds } }, orderBy: [{ instanceId: 'asc' }, { moduleOrder: 'asc' }] });
      for (const instanceId of instanceIds) {
        for (const task of createdTasks.filter((item) => item.instanceId === instanceId && item.moduleType === PerformanceModuleType.METRIC && (item.moduleSnapshot as { enabled?: boolean }).enabled !== false)) {
          await this.executeMetricTask(task as PerformanceTaskRecord, cycle.periodStart, cycle.periodEnd);
        }
        await this.advanceAssessment(instanceId, user);
      }
    }
    return this.getCycle(cycleId, user);
  }

  async updateCycleParticipantTemplate(
    user: AuthenticatedUser,
    cycleId: string,
    employeeId: string,
    dto: UpdatePerformanceCycleParticipantTemplateDto,
  ) {
    this.assertDatabaseMode();
    const instance = await this.prisma.performanceInstance.findFirst({
      where: { cycleId, employeeId },
      include: { cycle: { include: { instances: { select: { organizationId: true } } } }, tasks: { select: { status: true } } },
    });
    if (!instance) throw new NotFoundException('被考核人不存在于该绩效活动');
    await this.assertCycleScope(user, instance.cycle.instances, instance.cycle.organizationId);
    if (instance.status === ProcessStatus.COMPLETED || instance.tasks.some((task) => task.status === TaskStatus.COMPLETED)) {
      throw new ConflictException('人员绩效已完成后不能修改其模板');
    }
    const templateVersion = await this.prisma.performanceTemplateVersion.findFirst({
      where: { id: dto.templateVersionId, status: PerformanceVersionStatus.PUBLISHED },
    });
    if (!templateVersion) throw new BadRequestException('请选择已发布绩效模板');
    const definition = this.parser.assertValidDefinition(templateVersion.definition, true);
    const taskRows = this.buildModuleTaskRows({ id: instance.id, employeeId: instance.employeeId, organizationId: instance.organizationId }, definition);
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceModuleTask.deleteMany({ where: { instanceId: instance.id, status: { not: TaskStatus.COMPLETED } } });
      await tx.performanceModuleTask.createMany({ data: taskRows });
      await tx.performanceInstance.update({
        where: { id: instance.id },
        data: {
          sourceMarkdown: templateVersion.sourceMarkdown ?? '',
          definitionSnapshot: definition as unknown as Prisma.InputJsonValue,
          currentModuleOrder: instance.cycle.status === ProcessStatus.IN_PROGRESS
            ? definition.modules.findIndex((module) => module.enabled !== false && module.type !== PerformanceModuleType.METRIC)
            : null,
          assessmentStatus: instance.cycle.status === ProcessStatus.IN_PROGRESS ? ProcessStatus.IN_PROGRESS : ProcessStatus.DRAFT,
        },
      });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, instance.id, { resource: 'performance-cycle-participant', action: 'update-template', cycleId, employeeId, templateVersionId: templateVersion.id }, tx, 'performance_cycle_participant');
    });
    return this.getCycle(cycleId, user);
  }

  async createCycleParticipantAmountBase(user: AuthenticatedUser, cycleId: string, employeeId: string, dto: CreateCycleParticipantAmountBaseDto) {
    this.assertDatabaseMode();
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: cycleId }, include: { instances: { select: { organizationId: true, employeeId: true } } } });
    if (!cycle) throw new NotFoundException('绩效活动不存在');
    await this.assertCycleScope(user, cycle.instances, cycle.organizationId);
    const instance = cycle.instances.find((item) => item.employeeId === employeeId);
    if (!instance) throw new NotFoundException('被考核人不存在于该绩效活动');
    if (cycle.status !== ProcessStatus.DRAFT) throw new ConflictException('绩效活动启动后不能修改金额基数');
    const amount = MONEY(dto.amount);
    if (!Number.isFinite(dto.amount) || dto.amount < 0) throw new BadRequestException('金额基数必须是非负有限数字');
    const effectiveAt = new Date(dto.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime())) throw new BadRequestException('金额基数生效时间无效');
    const latest = await this.prisma.employeePerformanceAmountBase.findFirst({ where: { employeeId }, orderBy: { versionNo: 'desc' } });
    const row = await this.prisma.$transaction(async (tx) => {
      if (latest?.replacedAt === null) await tx.employeePerformanceAmountBase.update({ where: { id: latest.id }, data: { replacedAt: effectiveAt } });
      const created = await tx.employeePerformanceAmountBase.create({ data: { employeeId, versionNo: (latest?.versionNo ?? 0) + 1, amount, effectiveAt, changedById: user.id, changeReason: dto.reason.trim() } });
      await this.audit.create({ userId: user.id }, AuditAction.CREATE, created.id, { resource: 'cycle-participant-amount-base', cycleId, employeeId, amount: dto.amount, versionNo: created.versionNo }, tx, 'performance_cycle_participant');
      return created;
    });
    return { id: row.id, employeeId, versionNo: row.versionNo };
  }

  async exchangeFeishuTaskSession(state: string, code: string) {
    const sessions = this.feishuTaskSessions;
    if (!sessions?.enabled) throw new ConflictException('飞书绩效待办入口尚未启用');
    return sessions.exchange(state, code, (employeeId, cycleId) => this.getFeishuTaskInbox(employeeId, cycleId));
  }

  async getFeishuTaskInbox(employeeId: string, cycleId: string) {
    this.assertDatabaseMode();
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true, employeeNo: true } });
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: cycleId }, select: { id: true, name: true } });
    if (!employee || !cycle) throw new NotFoundException('飞书绩效待办不存在');
    const [assessmentTasks, workflowTasks] = await Promise.all([
      this.prisma.performanceModuleTask.findMany({
        where: { instance: { cycleId }, status: TaskStatus.IN_PROGRESS, assignees: { some: { employeeId, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } } } },
        include: { instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } } } }, assignees: { orderBy: { createdAt: 'asc' } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.performanceWorkflowTask.findMany({
        where: { instance: { cycleId }, status: TaskStatus.IN_PROGRESS, assignees: { some: { employeeId, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } } } },
        include: { instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } } } }, assignees: { orderBy: { createdAt: 'asc' } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      }),
    ]);
    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      employeeId: employee.id,
      employeeName: employee.name ?? '',
      employeeNo: employee.employeeNo,
      assessmentTasks: assessmentTasks.map((task) => this.presentTask(task, undefined)),
      workflowTasks: workflowTasks.map((task) => this.presentWorkflowTask(task, undefined)),
      totalPending: assessmentTasks.length + workflowTasks.length,
    };
  }

  async submitFeishuAssessmentTask(principal: FeishuTaskPrincipal, id: string, dto: PerformanceTaskSubmissionDto) {
    this.assertDatabaseMode();
    const task = await this.prisma.performanceModuleTask.findUnique({ where: { id }, include: { instance: { include: { cycle: true, tasks: { orderBy: { moduleOrder: 'asc' } } } }, assignees: { orderBy: { createdAt: 'asc' } } } });
    if (!task || task.instance.cycleId !== principal.cycleId) throw new NotFoundException('飞书绩效任务不存在');
    const assignee = task.assignees.find((item) => item.employeeId === principal.employeeId);
    if (!assignee) throw new ForbiddenException('当前员工不是此任务执行人');
    await this.submitTaskForEmployee(task as unknown as PerformanceTaskRecord, assignee as PerformanceTaskAssigneeRecord, dto, principal);
    await this.notifyFeishuTaskInbox(principal.employeeId, principal.cycleId);
    return this.getFeishuTaskInbox(principal.employeeId, principal.cycleId);
  }

  async submitFeishuWorkflowTask(principal: FeishuTaskPrincipal, id: string, dto: PerformanceWorkflowTaskSubmissionDto) {
    this.assertDatabaseMode();
    const task = await this.prisma.performanceWorkflowTask.findUnique({ where: { id }, include: { instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } } } }, assignees: { orderBy: { createdAt: 'asc' } } } });
    if (!task || task.instance.cycleId !== principal.cycleId) throw new NotFoundException('飞书绩效流程任务不存在');
    const assignee = task.assignees.find((item) => item.employeeId === principal.employeeId);
    if (!assignee) throw new ForbiddenException('当前员工不是此流程步骤执行人');
    await this.performWorkflowAction(task as unknown as PerformanceWorkflowTaskRecord, assignee as PerformanceWorkflowTaskAssigneeRecord, dto.action, dto.comment, PerformanceWorkflowActionSource.FEISHU, null, undefined);
    await this.notifyFeishuTaskInbox(principal.employeeId, principal.cycleId);
    return this.getFeishuTaskInbox(principal.employeeId, principal.cycleId);
  }

  private async submitTaskForEmployee(task: PerformanceTaskRecord, assignee: PerformanceTaskAssigneeRecord, dto: PerformanceTaskSubmissionDto, principal: FeishuTaskPrincipal) {
    if (assignee.status === TaskStatus.COMPLETED) throw new ConflictException('当前员工已经提交过此模块');
    if (task.status !== TaskStatus.IN_PROGRESS || task.instance?.currentModuleOrder !== task.moduleOrder) throw new ConflictException('当前模块尚未开放或已经完成');
    if (task.instance?.assessmentStatus === ProcessStatus.COMPLETED) throw new ConflictException('考核表已完成，不能重新提交评分');
    const module = task.moduleSnapshot as unknown as PerformanceModuleDefinition;
    if (module.requireAttachment) throw new ConflictException('当前模板要求附件，但附件能力尚未接入');
    if (module.requireComment && !dto.comment?.trim()) throw new BadRequestException('当前模块必须填写评语');
    if (task.moduleType === PerformanceModuleType.METRIC) throw new BadRequestException('业务指标模块由系统自动执行');
    const score = task.moduleType === PerformanceModuleType.EVALUATION ? dto.score : dto.adjustment;
    if (score === undefined || !Number.isFinite(score)) throw new BadRequestException(task.moduleType === PerformanceModuleType.EVALUATION ? '人工评估模块必须提交 0-100 分' : '调整模块必须提交调整分值');
    if (task.moduleType === PerformanceModuleType.EVALUATION && (score < 0 || score > 100)) throw new BadRequestException('人工评估模块分数必须在 0-100 范围内');
    if (task.moduleType === PerformanceModuleType.ADJUSTMENT && (score < (module.adjustmentMin ?? 0) || score > (module.adjustmentMax ?? module.adjustmentMin ?? 0))) throw new BadRequestException(`调整分值必须在 ${module.adjustmentMin ?? 0}-${module.adjustmentMax ?? 0} 范围内`);
    return this.submitAssigneeScore(task, assignee, {} as AuthenticatedUser, score, { score: task.moduleType === PerformanceModuleType.EVALUATION ? score : undefined, adjustment: task.moduleType === PerformanceModuleType.ADJUSTMENT ? score : undefined, comment: dto.comment?.trim() || undefined, source: 'FEISHU_WEB', employeeId: principal.employeeId });
  }

  async listTasks(user: AuthenticatedUser, query: QueryPerformanceDto, mine = false) {
    this.assertDatabaseMode();
    const scope = await this.access.getAccessibleOrganizationIds(user);
    const where: Prisma.PerformanceModuleTaskWhereInput = {
      ...(mine ? {
        OR: [
          { assignees: { some: { userId: user.id, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } } } },
          { executorUserId: user.id, assignees: { none: {} } },
        ],
      } : {}),
      ...(query.status && Object.values(TaskStatus).includes(query.status as unknown as TaskStatus) ? { status: query.status as unknown as TaskStatus } : {}),
      ...(scope === null ? {} : { employee: { assignments: { some: { status: AssignmentStatus.ACTIVE, archivedAt: null, organizationId: { in: scope }, isPrimary: true, endDate: null } } } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.performanceModuleTask.findMany({ where, include: { instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } }, tasks: { select: { id: true, moduleOrder: true, status: true } } } }, executorUser: { select: { displayName: true } }, assignees: { orderBy: { createdAt: 'asc' } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.performanceModuleTask.count({ where }),
    ]);
    return { data: rows.map((row) => this.presentTask(row, user.id)), meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async getTask(user: AuthenticatedUser, id: string) {
    this.assertDatabaseMode();
    const task = await this.prisma.performanceModuleTask.findUnique({ where: { id }, include: { instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } }, tasks: { orderBy: { moduleOrder: 'asc' } } } }, executorUser: { select: { displayName: true, username: true } }, assignees: { orderBy: { createdAt: 'asc' } } } });
    if (!task) throw new NotFoundException('绩效任务不存在');
    const current = task.instance.currentModuleOrder === task.moduleOrder && task.status === TaskStatus.IN_PROGRESS;
    if (current && !this.isTaskAssignee(task, user.id) && !this.access.hasPermission(user, 'performance.read')) throw new ForbiddenException('没有查看此绩效任务的权限');
    const previousResults = task.instance.tasks.filter((item) => item.moduleOrder < task.moduleOrder && item.status === TaskStatus.COMPLETED).map((item) => ({ moduleName: item.moduleName, moduleScore: this.number(item.moduleScore), rawData: item.rawData, calculationDetails: item.calculationDetails, submission: item.submission }));
    return { ...this.presentTask(task, user.id), moduleSnapshot: task.moduleSnapshot, rawData: task.rawData, calculationDetails: task.calculationDetails, submission: task.submission, moduleScore: this.number(task.moduleScore), previousResults };
  }

  async submitTask(user: AuthenticatedUser, id: string, dto: PerformanceTaskSubmissionDto) {
    this.assertDatabaseMode();
    if (!this.access.hasPermission(user, 'performance.task.handle')) throw new ForbiddenException('没有执行此操作的权限');
    const task = await this.prisma.performanceModuleTask.findUnique({
      where: { id },
      include: { instance: { include: { cycle: true, tasks: { orderBy: { moduleOrder: 'asc' } } } }, assignees: { orderBy: { createdAt: 'asc' } } },
    });
    if (!task) throw new NotFoundException('绩效任务不存在');
    const assignee = task.assignees.find((item) => item.userId === user.id);
    if (!assignee) {
      // Tasks created before the assignee table migration retain their original
      // single executor snapshot and remain actionable during the transition.
      if (task.assignees.length === 0 && task.executorUserId === user.id) {
        return this.completeLegacySingleTask(task, user, dto);
      }
      throw new ForbiddenException('当前账号不是此任务执行人');
    }
    if (assignee.status === TaskStatus.COMPLETED) throw new ConflictException('当前账号已经提交过此模块');
    if (task.status !== TaskStatus.IN_PROGRESS || task.instance.currentModuleOrder !== task.moduleOrder) throw new ConflictException('当前模块尚未开放或已经完成');
    if (task.instance.assessmentStatus === ProcessStatus.COMPLETED) throw new ConflictException('考核表已完成，不能重新提交评分');
    const module = task.moduleSnapshot as unknown as PerformanceModuleDefinition;
    if (module.requireAttachment) throw new ConflictException('当前模板要求附件，但附件能力尚未接入');
    if (module.requireComment && !dto.comment?.trim()) throw new BadRequestException('当前模块必须填写评语');
    if (task.moduleType === PerformanceModuleType.METRIC) throw new BadRequestException('业务指标模块由系统自动执行');
    const score = task.moduleType === PerformanceModuleType.EVALUATION ? dto.score : dto.adjustment;
    if (score === undefined) throw new BadRequestException(task.moduleType === PerformanceModuleType.EVALUATION ? '人工评估模块必须提交 0-100 分' : '调整模块必须提交调整分值');
    if (!Number.isFinite(score)) throw new BadRequestException('提交分数必须是有限数字');
    if (task.moduleType === PerformanceModuleType.EVALUATION && (score < 0 || score > 100)) throw new BadRequestException('人工评估模块分数必须在 0-100 范围内');
    if (task.moduleType === PerformanceModuleType.ADJUSTMENT && (score < (module.adjustmentMin ?? 0) || score > (module.adjustmentMax ?? module.adjustmentMin ?? 0))) throw new BadRequestException(`调整分值必须在 ${module.adjustmentMin ?? 0}-${module.adjustmentMax ?? 0} 范围内`);
    return this.submitAssigneeScore(task, assignee, user, score, { score: task.moduleType === PerformanceModuleType.EVALUATION ? score : undefined, adjustment: task.moduleType === PerformanceModuleType.ADJUSTMENT ? score : undefined, comment: dto.comment?.trim() || undefined });
  }

  async listWorkflowTasks(user: AuthenticatedUser, query: QueryPerformanceDto, mine = false) {
    this.assertDatabaseMode();
    const scope = await this.access.getAccessibleOrganizationIds(user);
    const where: Prisma.PerformanceWorkflowTaskWhereInput = {
      ...(mine ? { assignees: { some: { userId: user.id, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } } } } : {}),
      ...(query.status && Object.values(TaskStatus).includes(query.status as unknown as TaskStatus) ? { status: query.status as unknown as TaskStatus } : {}),
      ...(scope === null ? {} : { instance: { organizationId: { in: scope } } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.performanceWorkflowTask.findMany({
        where,
        include: {
          instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } } } },
          assignees: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.performanceWorkflowTask.count({ where }),
    ]);
    return { data: rows.map((row) => this.presentWorkflowTask(row, user.id)), meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async submitWorkflowTask(user: AuthenticatedUser, id: string, dto: PerformanceWorkflowTaskSubmissionDto) {
    this.assertDatabaseMode();
    if (!this.access.hasPermission(user, 'performance.task.handle')) throw new ForbiddenException('没有执行此操作的权限');
    const task = await this.prisma.performanceWorkflowTask.findUnique({
      where: { id },
      include: { instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } } } }, assignees: { orderBy: { createdAt: 'asc' } } },
    });
    if (!task) throw new NotFoundException('绩效流程任务不存在');
    const assignee = task.assignees.find((item) => item.userId === user.id);
    if (!assignee) throw new ForbiddenException('当前账号不是此流程步骤执行人');
    await this.performWorkflowAction(task as PerformanceWorkflowTaskRecord, assignee as PerformanceWorkflowTaskAssigneeRecord, dto.action, dto.comment, PerformanceWorkflowActionSource.WEB, user, undefined);
    return this.listWorkflowTasks(user, { page: 1, pageSize: 1 } as QueryPerformanceDto, true);
  }

  async handleLongConnectionCardAction(payload: Record<string, unknown>, callbackEventId?: string) {
    this.assertDatabaseMode();
    const action = this.cardActionPayload(payload);
    if (!action) {
      this.logCardCallbackFailure('动作内容无效', callbackEventId);
      return { toast: { type: 'error', content: '飞书卡片动作内容无效' } };
    }
    const operatorOpenId = this.cardOperatorOpenId(payload);
    if (!operatorOpenId) {
      this.logCardCallbackFailure('缺少操作人身份', callbackEventId);
      return { toast: { type: 'error', content: '飞书卡片缺少操作人身份' } };
    }
    try {
      await this.processFeishuCardAction(payload, action, operatorOpenId, callbackEventId);
      return { toast: { type: 'success', content: '已提交，绩效流程已更新' } };
    } catch (error) {
      const message = error instanceof Error ? error.message : '卡片处理失败';
      this.logCardCallbackFailure(message, callbackEventId);
      return { toast: { type: 'error', content: message } };
    }
  }

  private logCardCallbackFailure(reason: string, callbackEventId?: string) {
    // Keep diagnostics free of tokens, open_id, email and card form content.
    console.warn(`[FeishuCardAction] rejected event=${callbackEventId ?? 'none'} reason=${reason.slice(0, 240)}`);
  }

  async handleFeishuCardAction(
    body: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ) {
    this.assertDatabaseMode();
    const payload = this.verifyFeishuCallback(body, headers, rawBody);
    if (payload.type === 'url_verification' && typeof payload.challenge === 'string') return { challenge: payload.challenge };
    const action = this.cardActionPayload(payload);
    if (!action) throw new BadRequestException('飞书卡片动作内容无效');
    const operatorOpenId = this.cardOperatorOpenId(payload);
    if (!operatorOpenId) throw new UnauthorizedException('飞书卡片回调缺少操作人身份');
    await this.processFeishuCardAction(payload, action, operatorOpenId, this.cardCallbackEventId(payload));
    return { toast: { type: 'success', content: '已提交，绩效流程已更新' } };
  }

  private async processFeishuCardAction(
    payload: Record<string, any>,
    action: { kind: 'assessment' | 'workflow'; token: string; action?: PerformanceWorkflowAction; moduleType?: PerformanceModuleType },
    operatorOpenId: string,
    callbackEventId?: string,
  ) {
    const enrichedAction = {
      ...action,
      value: this.cardFormValue(payload, 'value'),
      comment: this.cardFormValue(payload, 'comment'),
    };
    if (action.kind === 'assessment') {
      await this.submitAssessmentCardAction(enrichedAction, operatorOpenId, callbackEventId, this.cardMessageId(payload));
    } else {
      await this.submitWorkflowCardAction(enrichedAction, operatorOpenId, callbackEventId);
    }
  }

  async listResults(user: AuthenticatedUser, query: QueryPerformanceDto) {
    this.assertDatabaseMode();
    const scope = await this.access.getAccessibleOrganizationIds(user);
    const where: Prisma.PerformanceInstanceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(scope === null ? {} : { organizationId: { in: scope } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.performanceInstance.findMany({ where, include: { cycle: true, employee: { select: { name: true, employeeNo: true } }, revisions: { select: { id: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.performanceInstance.count({ where }),
    ]);
    return { data: rows.map((row) => this.presentResult(row)), meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async getResult(id: string, user?: AuthenticatedUser) {
    this.assertDatabaseMode();
    const row = await this.prisma.performanceInstance.findUnique({
      where: { id },
      include: {
        cycle: true,
        employee: { select: { name: true, employeeNo: true } },
        tasks: { orderBy: { moduleOrder: 'asc' } },
        revisions: { orderBy: { revisionNo: 'asc' }, include: { modifiedBy: { select: { displayName: true } } } },
      },
    });
    if (!row) throw new NotFoundException('绩效结果不存在');
    if (user && !this.access.hasAllEmployeeData(user)) {
      const scope = await this.access.getAccessibleOrganizationIds(user);
      if (!scope?.includes(row.organizationId ?? '')) throw new ForbiddenException('绩效结果不存在');
    }
    return { ...this.presentResult(row), fixedWeightedScore: this.number(row.fixedWeightedScore), adjustmentScore: this.number(row.adjustmentScore) ?? 0, rawFinalScore: this.number(row.rawFinalScore), calculationFormula: row.calculationFormula, moduleResults: row.tasks.filter((task) => task.status === TaskStatus.COMPLETED).map((task) => ({ moduleName: task.moduleName, moduleType: task.moduleType, moduleWeight: this.number(task.moduleWeight), moduleScore: this.number(task.moduleScore), details: task.calculationDetails ?? task.submission })), revisions: row.revisions.map((revision) => ({ id: revision.id, revisionNo: revision.revisionNo, previousScore: this.number(revision.previousScore)!, nextScore: this.number(revision.nextScore)!, scoreDelta: this.number(revision.scoreDelta)!, previousAmount: this.number(revision.previousAmount), nextAmount: this.number(revision.nextAmount), reason: revision.reason, modifiedByName: revision.modifiedBy.displayName, modifiedAt: revision.createdAt.toISOString() })), definitionSnapshot: row.definitionSnapshot };
  }

  async modifyResult(user: AuthenticatedUser, id: string, dto: ModifyPerformanceResultDto) {
    this.assertDatabaseMode();
    if (!Number.isFinite(dto.finalScore)) throw new BadRequestException('最终分数必须是有限数字');
    const row = await this.prisma.performanceInstance.findUnique({ where: { id } });
    if (!row || row.finalScore === null) throw new NotFoundException('绩效结果不存在或尚未生成');
    if (!this.access.hasAllEmployeeData(user)) {
      const scope = await this.access.getAccessibleOrganizationIds(user);
      if (!scope?.includes(row.organizationId ?? '')) throw new ForbiddenException('绩效结果不存在');
    }
    if (!dto.reason.trim()) throw new BadRequestException('修改原因不能为空');
    const amount = row.employeeAmountBaseSnapshot === null ? null : Number(row.employeeAmountBaseSnapshot) * dto.finalScore / 100;
    const revisionNo = (await this.prisma.performanceResultRevision.count({ where: { instanceId: id } })) + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceResultRevision.create({ data: { instanceId: id, revisionNo, previousScore: row.finalScore!, nextScore: DECIMAL(dto.finalScore), scoreDelta: DECIMAL(dto.finalScore - Number(row.finalScore)), previousAmount: row.actualAmount, nextAmount: amount === null ? null : MONEY(amount), reason: dto.reason.trim(), beforeSnapshot: { finalScore: this.number(row.finalScore), actualAmount: this.number(row.actualAmount) }, afterSnapshot: { finalScore: dto.finalScore, actualAmount: amount }, modifiedById: user.id } });
      await tx.performanceInstance.update({ where: { id }, data: { finalScore: DECIMAL(dto.finalScore), actualAmount: amount === null ? null : MONEY(amount) } });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, id, { resource: 'performance-result', action: 'modify', revisionNo, previousScore: this.number(row.finalScore), nextScore: dto.finalScore, reason: dto.reason.trim() }, tx, 'performance_result');
    });
    return this.getResult(id);
  }

  async listEmployeeAmountBases(user: AuthenticatedUser, query: QueryEmployeePerformanceAmountBaseDto) {
    this.assertDatabaseMode();
    const scope = await this.access.getAccessibleOrganizationIds(user);
    const where: Prisma.EmployeePerformanceAmountBaseWhereInput = {
      replacedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(scope === null ? {} : { employee: { assignments: { some: { organizationId: { in: scope }, status: AssignmentStatus.ACTIVE, archivedAt: null, isPrimary: true, endDate: null } } } }),
      ...(query.keyword ? { employee: { OR: [{ name: { contains: query.keyword } }, { employeeNo: { contains: query.keyword } }] } } : {}),
    };
    const employeeWhere: Prisma.EmployeeWhereInput = {
      recordStatus: RecordStatus.ACTIVE,
      archivedAt: null,
      ...(scope === null ? {} : { assignments: { some: { organizationId: { in: scope }, status: AssignmentStatus.ACTIVE, archivedAt: null, isPrimary: true, endDate: null } } }),
      ...(query.employeeId ? { id: query.employeeId } : {}),
      ...(query.keyword ? { OR: [{ name: { contains: query.keyword } }, { employeeNo: { contains: query.keyword } }] } : {}),
    };
    const [employees, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({ where: employeeWhere, select: { id: true, employeeNo: true, name: true, assignments: { where: { status: AssignmentStatus.ACTIVE, archivedAt: null, isPrimary: true, endDate: null }, select: { organization: { select: { name: true } } }, take: 1 }, performanceAmountBases: { where: { replacedAt: null }, orderBy: { versionNo: 'desc' }, take: 1, include: { changedBy: { select: { displayName: true } } } } }, orderBy: { employeeNo: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.employee.count({ where: employeeWhere }),
    ]);
    return { data: employees.map((employee) => this.presentEmployeeAmountBase(employee.performanceAmountBases[0] ? { ...employee.performanceAmountBases[0], employee } : { id: `unconfigured-${employee.id}`, employeeId: employee.id, employee, versionNo: 0, amount: new Prisma.Decimal(0), effectiveAt: new Date(0), replacedAt: null, changedBy: null, changeReason: '' })), meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async listEmployeeAmountBaseHistory(user: AuthenticatedUser, employeeId: string) {
    this.assertDatabaseMode();
    await this.assertEmployeeAmountBaseScope(user, employeeId);
    const rows = await this.prisma.employeePerformanceAmountBase.findMany({ where: { employeeId }, include: { employee: { select: { employeeNo: true, name: true, assignments: { where: { status: AssignmentStatus.ACTIVE, archivedAt: null, isPrimary: true, endDate: null }, select: { organization: { select: { name: true } } }, take: 1 } } }, changedBy: { select: { displayName: true } } }, orderBy: { versionNo: 'desc' } });
    return rows.map((row) => this.presentEmployeeAmountBase(row));
  }

  async createEmployeeAmountBase(user: AuthenticatedUser, dto: CreateEmployeePerformanceAmountBaseDto) {
    this.assertDatabaseMode();
    await this.assertEmployeeAmountBaseScope(user, dto.employeeId);
    const latest = await this.prisma.employeePerformanceAmountBase.findFirst({ where: { employeeId: dto.employeeId }, orderBy: { versionNo: 'desc' } });
    const effectiveAt = new Date(dto.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime())) throw new BadRequestException('金额基数生效时间无效');
    const row = await this.prisma.$transaction(async (tx) => {
      if (latest?.replacedAt === null) await tx.employeePerformanceAmountBase.update({ where: { id: latest.id }, data: { replacedAt: effectiveAt } });
      const version = await tx.employeePerformanceAmountBase.create({ data: { employeeId: dto.employeeId, versionNo: (latest?.versionNo ?? 0) + 1, amount: MONEY(dto.amount), effectiveAt, changedById: user.id, changeReason: dto.reason.trim() }, include: { employee: { select: { employeeNo: true, name: true, assignments: { where: { status: AssignmentStatus.ACTIVE, archivedAt: null, isPrimary: true, endDate: null }, select: { organization: { select: { name: true } } }, take: 1 } } }, changedBy: { select: { displayName: true } } } });
      await this.audit.create({ userId: user.id }, AuditAction.CREATE, version.id, { resource: 'employee-performance-amount-base', employeeId: dto.employeeId, versionNo: version.versionNo, amount: dto.amount, reason: dto.reason.trim() }, tx, 'employee_performance_amount_base');
      return version;
    });
    return this.presentEmployeeAmountBase(row);
  }

  async getDashboard() {
    this.assertDatabaseMode();
    const [templateCount, activeTaskCount, pendingResultCount] = await this.prisma.$transaction([
      this.prisma.performanceTemplate.count({ where: { status: RecordStatus.ACTIVE, archivedAt: null } }),
      this.prisma.performanceModuleTask.count({ where: { status: TaskStatus.IN_PROGRESS } }),
      this.prisma.performanceInstance.count({ where: { status: ProcessStatus.COMPLETED } }),
    ]);
    return { templateCount, activeTaskCount, pendingResultCount };
  }

  private assertTemplatePayload(dto: CreatePerformanceTemplateDto) {
    const definition = this.parser.assertValidDefinition(dto.definition, true);
    if (dto.sourceType === PerformanceTemplateSourceType.MANUAL) return definition;
    if (!dto.sourceMarkdown?.trim()) throw new BadRequestException('Markdown 来源模板必须提供原始 Markdown 内容');
    const parsed = this.parser.parse(dto.sourceMarkdown, dto.sourceName ?? null);
    if (parsed.errors.length > 0) throw new BadRequestException(parsed.errors.map((error) => `${error.path}: ${error.message}`));
    if (!parsed.definition) throw new BadRequestException('Markdown 未能解析为模板结构');
    // The edited definition is the HR-confirmed executable projection of the
    // parsed document. It may add fields unavailable in natural language, such
    // as execution mode, data mappings and safe scoring rules.
    return definition;
  }

  private buildModuleTaskRows(
    instance: { id: string; employeeId: string; organizationId: string | null },
    definition: PerformanceTemplateDefinition,
    options: { status?: TaskStatus } = {},
  ) {
    return definition.modules.map((module, moduleOrder) => ({
      id: randomUUID(),
      instanceId: instance.id,
      employeeId: instance.employeeId,
      moduleId: module.id,
      moduleOrder,
      moduleName: module.name,
      moduleType: module.type,
      moduleWeight: module.weight === null ? null : DECIMAL(module.weight),
      moduleSnapshot: module as unknown as Prisma.InputJsonValue,
      executorType: module.executor.type,
      executionMode: this.executionMode(module),
      executorUserId: null,
      executorDirectoryType: module.executor.directoryType,
      executorDirectoryId: module.executor.directoryId,
      status: options.status ?? TaskStatus.PENDING,
    }));
  }

  private executionMode(module: PerformanceModuleDefinition) {
    return module.executor.executionMode ?? PerformanceExecutionMode.SINGLE;
  }

  private executorEmployeeIds(module: PerformanceModuleDefinition) {
    return [...new Set((module.executor.employeeIds ?? []).filter((id): id is string => Boolean(id?.trim())).map((id) => id.trim()))];
  }

  private executorUserIds(module: PerformanceModuleDefinition) {
    const configured = module.executor.userIds ?? (module.executor.userId ? [module.executor.userId] : []);
    return [...new Set(configured.filter((id): id is string => Boolean(id?.trim())).map((id) => id.trim()))];
  }

  private async resolveExecutorEmployees(module: PerformanceModuleDefinition, effectiveAt = new Date()) {
    const employeeIds = this.executorEmployeeIds(module);
    const legacyUserIds = employeeIds.length === 0 ? this.executorUserIds(module) : [];
    if (employeeIds.length === 0 && legacyUserIds.length === 0) return [];
    const employees = await this.prisma.employee.findMany({
      where: {
        ...(employeeIds.length > 0 ? { id: { in: employeeIds } } : {
          user: {
            id: { in: legacyUserIds },
            status: RecordStatus.ACTIVE,
            archivedAt: null,
          },
        }),
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        assignments: {
          some: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            isPrimary: true,
            startDate: { lte: effectiveAt },
            OR: [{ endDate: null }, { endDate: { gte: effectiveAt } }],
          },
        },
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        workEmail: true,
        mobile: true,
        user: { select: { id: true, username: true, displayName: true, status: true, archivedAt: true } },
      },
    });
    const expectedCount = employeeIds.length || legacyUserIds.length;
    if (employees.length !== expectedCount) throw new BadRequestException(`模块“${module.name}”存在没有有效主要任职的执行人员`);
    return employeeIds.length > 0
      ? employeeIds.map((employeeId) => employees.find((employee) => employee.id === employeeId)!)
      : legacyUserIds.map((userId) => employees.find((employee) => employee.user?.id === userId)!);
  }

  private workflowManualSteps(definition: Pick<PerformanceTemplateDefinition, 'workflow'>) {
    return definition.workflow?.manualSteps ?? [];
  }

  private async assertExecutorUserScope(user: AuthenticatedUser, definition: PerformanceTemplateDefinition) {
    const executorDefinitions = [
      ...definition.modules.map((module) => ({ name: module.name, executor: module.executor })),
      ...this.workflowManualSteps(definition)
        .filter((step): step is PerformanceWorkflowManualStepDefinition & { executor: PerformanceExecutorDefinition } => Boolean(step.executor))
        .map((step) => ({ name: step.name, executor: step.executor })),
    ];
    const employeeIds = [...new Set(executorDefinitions.flatMap((item) => item.executor.type === PerformanceExecutorType.USER ? [...new Set((item.executor.employeeIds ?? []).filter((id): id is string => Boolean(id?.trim())).map((id) => id.trim()))] : []))];
    const legacyUserIds = [...new Set(executorDefinitions.flatMap((item) => {
      if (item.executor.type !== PerformanceExecutorType.USER || (item.executor.employeeIds?.length ?? 0) > 0) return [];
      const values = item.executor.userIds ?? (item.executor.userId ? [item.executor.userId] : []);
      return values.filter((id): id is string => Boolean(id?.trim())).map((id) => id.trim());
    }))];
    const directoryExecutors = executorDefinitions.filter((item) => item.executor.type === PerformanceExecutorType.DIRECTORY);
    if (employeeIds.length === 0 && legacyUserIds.length === 0 && directoryExecutors.length === 0) return;
    const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user);
    const now = new Date();
    const scopedEmployees = employeeIds.length ? await this.prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        assignments: {
          some: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            isPrimary: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
            ...(accessibleOrganizationIds === null ? {} : { organizationId: { in: accessibleOrganizationIds } }),
          },
        },
      },
      select: { id: true },
    }) : [];
    if (scopedEmployees.length !== employeeIds.length) {
      throw new ForbiddenException('指定执行人员不在当前账号数据范围内或没有有效主要任职');
    }
    if (legacyUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: legacyUserIds },
          status: RecordStatus.ACTIVE,
          archivedAt: null,
          employee: {
            recordStatus: RecordStatus.ACTIVE,
            archivedAt: null,
            assignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                archivedAt: null,
                isPrimary: true,
                startDate: { lte: now },
                OR: [{ endDate: null }, { endDate: { gte: now } }],
                ...(accessibleOrganizationIds === null ? {} : { organizationId: { in: accessibleOrganizationIds } }),
              },
            },
          },
        },
        select: { id: true },
      });
      if (users.length !== legacyUserIds.length) throw new ForbiddenException('指定执行人不在当前账号数据范围内、没有有效任职或账号已停用');
    }
    for (const module of directoryExecutors) {
      const directoryFilter = module.executor.directoryType === PerformanceDirectoryType.POSITION
        ? { positionId: module.executor.directoryId }
        : { jobTitleId: module.executor.directoryId };
      const matches = await this.prisma.employee.findMany({
        where: {
          recordStatus: RecordStatus.ACTIVE,
          archivedAt: null,
          assignments: {
            some: {
              ...directoryFilter,
              status: AssignmentStatus.ACTIVE,
              archivedAt: null,
              isPrimary: true,
              startDate: { lte: now },
              OR: [{ endDate: null }, { endDate: { gte: now } }],
              ...(accessibleOrganizationIds === null ? {} : { organizationId: { in: accessibleOrganizationIds } }),
            },
          },
        },
        select: { id: true },
        take: 2,
      });
      if (matches.length !== 1) throw new BadRequestException(`步骤“${module.name}”岗位执行人必须唯一匹配一名当前数据范围内的有效在职人员`);
    }
  }

  private async completeTask(
    task: PerformanceTaskRecord,
    user: AuthenticatedUser,
    moduleScore: number,
    submission: Record<string, unknown>,
  ) {
    if (!task.instance) throw new ConflictException('绩效任务关联实例不存在');
    const nextTask = task.instance.tasks.find((item) => item.moduleOrder > task.moduleOrder
      && item.status !== TaskStatus.CANCELLED
      && item.moduleType !== PerformanceModuleType.METRIC
      && (item.moduleSnapshot as { enabled?: boolean }).enabled !== false);
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceModuleTask.update({ where: { id: task.id }, data: { status: TaskStatus.COMPLETED, moduleScore: DECIMAL(moduleScore), submission: submission as Prisma.InputJsonValue, completedAt: new Date() } });
      if (nextTask) await tx.performanceModuleTask.update({ where: { id: nextTask.id, status: TaskStatus.PENDING }, data: { status: TaskStatus.IN_PROGRESS } });
      await tx.performanceInstance.update({ where: { id: task.instanceId, currentModuleOrder: task.moduleOrder }, data: { currentModuleOrder: nextTask?.moduleOrder ?? null } });
      await this.audit.create(user.id ? { userId: user.id } : {}, AuditAction.UPDATE, task.id, { resource: 'performance-task', action: 'submit', moduleScore }, tx, 'performance_task');
    });
    await this.advanceAssessment(task.instanceId, user);
    return this.getTask(user, task.id);
  }

  private async completeLegacySingleTask(task: PerformanceTaskRecord, user: AuthenticatedUser, dto: PerformanceTaskSubmissionDto) {
    if (task.status !== TaskStatus.IN_PROGRESS || task.instance?.currentModuleOrder !== task.moduleOrder) throw new ConflictException('当前模块尚未开放或已经完成');
    if (task.instance?.assessmentStatus === ProcessStatus.COMPLETED) throw new ConflictException('考核表已完成，不能重新提交评分');
    const module = task.moduleSnapshot as unknown as PerformanceModuleDefinition;
    if (module.requireAttachment) throw new ConflictException('当前模板要求附件，但附件能力尚未接入');
    if (module.requireComment && !dto.comment?.trim()) throw new BadRequestException('当前模块必须填写评语');
    if (task.moduleType === PerformanceModuleType.METRIC) throw new BadRequestException('业务指标模块由系统自动执行');
    const score = task.moduleType === PerformanceModuleType.EVALUATION ? dto.score : dto.adjustment;
    if (score === undefined) throw new BadRequestException(task.moduleType === PerformanceModuleType.EVALUATION ? '人工评估模块必须提交 0-100 分' : '调整模块必须提交调整分值');
    if (!Number.isFinite(score)) throw new BadRequestException('提交分数必须是有限数字');
    if (task.moduleType === PerformanceModuleType.EVALUATION && (score < 0 || score > 100)) throw new BadRequestException('人工评估模块分数必须在 0-100 范围内');
    if (task.moduleType === PerformanceModuleType.ADJUSTMENT && (score < (module.adjustmentMin ?? 0) || score > (module.adjustmentMax ?? module.adjustmentMin ?? 0))) throw new BadRequestException(`调整分值必须在 ${module.adjustmentMin ?? 0}-${module.adjustmentMax ?? 0} 范围内`);
    return this.completeTask(task, user, score, { score: task.moduleType === PerformanceModuleType.EVALUATION ? score : undefined, adjustment: task.moduleType === PerformanceModuleType.ADJUSTMENT ? score : undefined, comment: dto.comment?.trim() || undefined });
  }

  private async submitAssigneeScore(
    task: PerformanceTaskRecord,
    assignee: PerformanceTaskAssigneeRecord,
    user: AuthenticatedUser,
    score: number,
    submission: Record<string, unknown>,
  ) {
    if (task.instance?.assessmentStatus === ProcessStatus.COMPLETED) throw new ConflictException('考核表已完成，不能重新提交评分');
    const submittedAt = new Date();
    const updated = await this.prisma.performanceModuleTaskAssignee.updateMany({
      where: { id: assignee.id, status: { not: TaskStatus.COMPLETED } },
      data: {
        status: TaskStatus.COMPLETED,
        score: DECIMAL(score),
        submission: submission as Prisma.InputJsonValue,
        completedAt: submittedAt,
      },
    });
    if (updated.count !== 1) throw new ConflictException('当前执行人已经提交过此模块');
    await this.audit.create(user.id ? { userId: user.id } : {}, AuditAction.UPDATE, assignee.id, { resource: 'performance-task-assignee', taskId: task.id, action: 'submit', score, source: submission.source === 'FEISHU_WEB' ? 'FEISHU_WEB' : 'WEB' }, this.prisma, 'performance_module_task_assignee');

    const assignees = await this.prisma.performanceModuleTaskAssignee.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: 'asc' },
    });
    if (assignees.some((item) => item.status !== TaskStatus.COMPLETED || item.score === null)) {
      return user.id ? this.getTask(user, task.id) : undefined;
    }
    if (assignees.length === 0) throw new ConflictException('当前模块没有可汇总的执行人提交');

    const moduleScore = assignees.reduce((sum, item) => sum + Number(item.score), 0) / assignees.length;
    const summary = {
      executionMode: task.executionMode,
      aggregation: 'AVERAGE',
      assigneeCount: assignees.length,
      assignees: assignees.map((item) => ({ userId: item.userId, displayName: item.displayNameSnapshot, score: Number(item.score), submission: item.submission })),
    };
    return this.completeTask(task, user, moduleScore, summary);
  }

  private async performWorkflowAction(
    task: PerformanceWorkflowTaskRecord,
    assignee: PerformanceWorkflowTaskAssigneeRecord,
    action: PerformanceWorkflowAction,
    comment: string | undefined,
    source: PerformanceWorkflowActionSource,
    user: AuthenticatedUser | null,
    callbackEventId: string | undefined,
  ) {
    if (!task.instance) throw new ConflictException('流程任务关联实例不存在');
    if (task.status !== TaskStatus.IN_PROGRESS || task.instance.currentWorkflowOrder !== task.stepOrder) throw new ConflictException('当前流程步骤尚未开放或已经完成');
    if (assignee.status === TaskStatus.COMPLETED) throw new ConflictException('当前执行人已经处理过此流程步骤');
    const isReviewOrApproval = task.stepType === PerformanceWorkflowStepType.REVIEW || task.stepType === PerformanceWorkflowStepType.APPROVAL;
    const expectedAction = task.stepType === PerformanceWorkflowStepType.CONFIRMATION
      ? PerformanceWorkflowAction.CONFIRM
      : task.stepType === PerformanceWorkflowStepType.HR_ARCHIVE
        ? PerformanceWorkflowAction.ARCHIVE
        : undefined;
    if (expectedAction && action !== expectedAction) throw new BadRequestException('当前流程步骤不支持此处理动作');
    if (isReviewOrApproval && action !== PerformanceWorkflowAction.APPROVE && action !== PerformanceWorkflowAction.REJECT) throw new BadRequestException('审核或审批步骤只能通过或驳回');
    if (action === PerformanceWorkflowAction.REJECT && !comment?.trim()) throw new BadRequestException('驳回流程步骤时必须填写原因');

    const now = new Date();
    const actor = user ? { id: user.id } : null;
    const completed = await this.prisma.$transaction(async (tx) => {
      if (callbackEventId) {
        const existingAction = await tx.performanceWorkflowTaskAction.findUnique({ where: { callbackEventId } });
        if (existingAction) throw new ConflictException('飞书回调已处理');
      }
      const completeAssignee = await tx.performanceWorkflowTaskAssignee.updateMany({
        where: {
          id: assignee.id,
          status: TaskStatus.IN_PROGRESS,
          ...(source === PerformanceWorkflowActionSource.FEISHU ? { cardConsumedAt: null } : {}),
        },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: now,
          ...(source === PerformanceWorkflowActionSource.FEISHU ? { cardConsumedAt: now } : {}),
        },
      });
      if (completeAssignee.count !== 1) throw new ConflictException('该流程卡片已经被处理或执行人状态已变化');
      await tx.performanceWorkflowTaskAction.create({
        data: {
          taskId: task.id,
          assigneeId: assignee.id,
          action,
          source,
          comment: comment?.trim() || null,
          actorUserId: actor?.id ?? null,
          callbackEventId: callbackEventId ?? null,
        },
      });
      await this.audit.create(
        actor?.id ? { userId: actor.id } : {},
        AuditAction.UPDATE,
        task.id,
        { resource: 'performance-workflow-task', action, source, stepType: task.stepType, comment: comment?.trim() || null },
        tx,
        'performance_workflow_task',
      );
      return true;
    });
    if (!completed) throw new ConflictException('该流程卡片已经被处理或执行人状态已变化');

    if (action === PerformanceWorkflowAction.REJECT) {
      await this.handleWorkflowRejection(task, user);
      return;
    }
    const allAssignees = await this.prisma.performanceWorkflowTaskAssignee.findMany({ where: { taskId: task.id } });
    if (allAssignees.some((item) => item.status !== TaskStatus.COMPLETED)) return;
    await this.completeWorkflowTask(task, user);
  }

  private async completeWorkflowTask(task: PerformanceWorkflowTaskRecord, user: AuthenticatedUser | null) {
    const definition = (await this.prisma.performanceInstance.findUniqueOrThrow({ where: { id: task.instanceId }, select: { definitionSnapshot: true } })).definitionSnapshot as unknown as PerformanceTemplateDefinition;
    const steps = this.workflowManualSteps(definition);
    const nextIndex = task.stepOrder + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceWorkflowTask.update({ where: { id: task.id }, data: { status: TaskStatus.COMPLETED, completedAt: new Date() } });
      await tx.performanceInstance.update({
        where: { id: task.instanceId, currentWorkflowOrder: task.stepOrder },
        data: nextIndex >= steps.length
          ? { currentWorkflowOrder: null, workflowCompletedAt: new Date(), status: ProcessStatus.COMPLETED }
          : { currentWorkflowOrder: nextIndex, status: ProcessStatus.IN_PROGRESS },
      });
      await this.audit.create(user?.id ? { userId: user.id } : {}, AuditAction.UPDATE, task.id, { resource: 'performance-workflow-task', action: 'complete' }, tx, 'performance_workflow_task');
    });
    if (nextIndex < steps.length) await this.openWorkflowStep(task.instanceId, nextIndex);
  }

  private async handleWorkflowRejection(task: PerformanceWorkflowTaskRecord, user: AuthenticatedUser | null) {
    const strategy = task.rejectionStrategy ?? PerformanceWorkflowRejectionStrategy.END;
    const instance = await this.prisma.performanceInstance.findUniqueOrThrow({ where: { id: task.instanceId }, select: { definitionSnapshot: true } });
    const steps = this.workflowManualSteps(instance.definitionSnapshot as unknown as PerformanceTemplateDefinition);
    const targetIndex = strategy === PerformanceWorkflowRejectionStrategy.RETURN_PREVIOUS
      ? task.stepOrder - 1
      : strategy === PerformanceWorkflowRejectionStrategy.RETURN_TO_STEP
        ? steps.findIndex((step) => step.id === task.rejectionTargetStepId)
        : -1;
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceWorkflowTask.update({ where: { id: task.id }, data: { status: TaskStatus.CANCELLED, completedAt: new Date() } });
      await tx.performanceWorkflowTaskAssignee.updateMany({ where: { taskId: task.id, status: { not: TaskStatus.COMPLETED } }, data: { status: TaskStatus.CANCELLED } });
      await tx.performanceInstance.update({
        where: { id: task.instanceId, currentWorkflowOrder: task.stepOrder },
        data: targetIndex < 0
          ? { currentWorkflowOrder: null, workflowCompletedAt: new Date(), status: ProcessStatus.REJECTED }
          : { currentWorkflowOrder: targetIndex, status: ProcessStatus.IN_PROGRESS },
      });
      await this.audit.create(user?.id ? { userId: user.id } : {}, AuditAction.UPDATE, task.id, { resource: 'performance-workflow-task', action: 'reject', strategy, targetIndex }, tx, 'performance_workflow_task');
    });
    if (targetIndex >= 0) {
      const priorAttempts = await this.prisma.performanceWorkflowTask.count({ where: { instanceId: task.instanceId, stepOrder: targetIndex } });
      await this.openWorkflowStep(task.instanceId, targetIndex, priorAttempts + 1);
    }
  }

  private async resultUpdate(tasks: Array<{ status: TaskStatus; moduleType: PerformanceModuleType; moduleWeight: Prisma.Decimal | null; moduleSnapshot: Prisma.JsonValue; moduleScore: Prisma.Decimal | null }>, employeeId: string) {
    const enabledTasks = tasks.filter((task) => (task.moduleSnapshot as { enabled?: boolean }).enabled !== false);
    if (enabledTasks.some((task) => task.status !== TaskStatus.COMPLETED || task.moduleScore === null)) throw new BadRequestException('所有启用的绩效模块完成后才能生成结果');
    const completed = enabledTasks;
    const fixedTasks = completed.filter((task) => (task.moduleSnapshot as { participatesInTotal?: boolean }).participatesInTotal === true);
    if (fixedTasks.some((task) => task.moduleWeight === null)) throw new BadRequestException('固定权重模块缺少模块权重');
    const fixedWeightTotal = fixedTasks.reduce((sum, task) => sum + Number(task.moduleWeight ?? 0), 0);
    if (Math.abs(fixedWeightTotal - 100) > 0.0001) throw new BadRequestException(`已完成固定模块权重合计必须为 100%，当前为 ${fixedWeightTotal}%`);
    const adjustmentTasks = completed.filter((task) => task.moduleType === PerformanceModuleType.ADJUSTMENT);
    const adjustmentScore = adjustmentTasks.reduce((sum, task) => {
      const snapshot = task.moduleSnapshot as { adjustmentDirection?: string };
      return sum + (snapshot.adjustmentDirection === 'DEDUCT' ? -1 : 1) * Number(task.moduleScore);
    }, 0);
    const fixedWeightedScore = fixedTasks.reduce((sum, task) => sum + Number(task.moduleScore) * Number(task.moduleWeight ?? 0) / 100, 0);
    const rawFinalScore = fixedWeightedScore + adjustmentScore;
    const finalScore = Math.max(0, rawFinalScore);
    const amountSnapshot = await this.resolveEmployeeAmountBaseSnapshot(employeeId, finalScore);
    return { fixedWeightedScore: DECIMAL(fixedWeightedScore), adjustmentScore: DECIMAL(adjustmentScore), rawFinalScore: DECIMAL(rawFinalScore), finalScore: DECIMAL(finalScore), calculationFormula: 'Σ(模块得分 × 模块权重 ÷ 100) + 调整项; 最低为 0', ...amountSnapshot };
  }

  /**
   * Advances scored assessment work only. Business metrics are pre-calculated
   * at activity start and therefore never become visible workflow nodes.
   */
  private async advanceAssessment(instanceId: string, user: AuthenticatedUser) {
    const instance = await this.prisma.performanceInstance.findUnique({
      where: { id: instanceId },
      include: { cycle: true, tasks: { include: { assignees: { orderBy: { createdAt: 'asc' } } }, orderBy: { moduleOrder: 'asc' } } },
    });
    if (!instance || instance.assessmentStatus === ProcessStatus.COMPLETED) return;
    const enabledTasks = instance.tasks.filter((task) => (task.moduleSnapshot as { enabled?: boolean }).enabled !== false);
    const pendingManualTask = enabledTasks.find((task) => task.moduleType !== PerformanceModuleType.METRIC && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED);
    if (pendingManualTask) {
      if (pendingManualTask.status === TaskStatus.PENDING) {
        await this.prisma.$transaction(async (tx) => {
          await tx.performanceModuleTask.update({ where: { id: pendingManualTask.id, status: TaskStatus.PENDING }, data: { status: TaskStatus.IN_PROGRESS } });
          await tx.performanceInstance.update({ where: { id: instance.id }, data: { currentModuleOrder: pendingManualTask.moduleOrder, assessmentStatus: ProcessStatus.IN_PROGRESS } });
        });
      }
      await this.openManualTask({ ...pendingManualTask, instance } as PerformanceTaskRecord, instance.cycle.periodStart);
      return;
    }
    if (enabledTasks.some((task) => task.status !== TaskStatus.COMPLETED || task.moduleScore === null)) {
      throw new ConflictException('考核表中仍有未完成的模块');
    }

    const resultUpdate = await this.resultUpdate(enabledTasks, instance.employeeId);
    const manualSteps = this.workflowManualSteps(instance.definitionSnapshot as unknown as PerformanceTemplateDefinition);
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceInstance.update({
        where: { id: instance.id },
        data: {
          currentModuleOrder: null,
          assessmentStatus: ProcessStatus.COMPLETED,
          assessmentCompletedAt: new Date(),
          ...(manualSteps.length === 0
            ? { status: ProcessStatus.COMPLETED, workflowCompletedAt: new Date() }
            : { status: ProcessStatus.IN_PROGRESS }),
          ...resultUpdate,
        },
      });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, instance.id, { resource: 'performance-assessment', action: 'complete' }, tx, 'performance_instance');
    });
    if (manualSteps.length > 0) await this.openWorkflowStep(instance.id, 0);
  }


  private async openManualTask(task: PerformanceTaskRecord, effectiveAt: Date) {
    if (task.moduleType === PerformanceModuleType.METRIC) return;
    const assignees = await this.resolveTaskAssignees(task, effectiveAt);
    if (assignees.length === 0) throw new BadRequestException(`模块“${task.moduleName}”未解析到有效执行人`);
    await this.notifyTaskOpened(task.id);
  }

  private async openWorkflowStep(instanceId: string, manualStepIndex: number, attemptNo = 1) {
    const instance = await this.prisma.performanceInstance.findUnique({
      where: { id: instanceId },
      include: {
        cycle: true,
        employee: { select: { id: true, name: true, employeeNo: true, workEmail: true, mobile: true, user: { select: { id: true, username: true, displayName: true, status: true, archivedAt: true } } } },
      },
    });
    if (!instance || instance.assessmentStatus !== ProcessStatus.COMPLETED) return;
    if (instance.finalScore === null || instance.actualAmount === null) {
      throw new ConflictException('最终得分和实际金额生成后才能进入审核确认流程');
    }
    const definition = instance.definitionSnapshot as unknown as PerformanceTemplateDefinition;
    const step = this.workflowManualSteps(definition)[manualStepIndex];
    if (!step) {
      await this.prisma.performanceInstance.update({
        where: { id: instance.id },
        data: { currentWorkflowOrder: null, workflowCompletedAt: new Date(), status: ProcessStatus.COMPLETED },
      });
      return;
    }

    const existing = await this.prisma.performanceWorkflowTask.findUnique({
      where: { instanceId_stepOrder_attemptNo: { instanceId, stepOrder: manualStepIndex, attemptNo } },
      include: { assignees: true },
    });
    if (existing?.status === TaskStatus.IN_PROGRESS) return;

    const effectiveAt = instance.cycle.periodStart;
    const executors = await this.resolveWorkflowExecutors(step, effectiveAt);
    if (executors.length === 0) throw new BadRequestException(`流程步骤“${step.name}”未解析到有效执行人`);
    const executionMode = this.executorExecutionMode(step.executor);
    if (executionMode === PerformanceExecutionMode.SINGLE && executors.length !== 1) throw new BadRequestException(`流程步骤“${step.name}”单人执行必须唯一指定一名人员`);
    if (executionMode === PerformanceExecutionMode.MULTIPLE && executors.length < 2) throw new BadRequestException(`流程步骤“${step.name}”多人执行必须至少指定两名人员`);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.performanceWorkflowTask.create({
        data: {
          instanceId,
          stepId: step.id,
          stepOrder: manualStepIndex,
          attemptNo,
          stepName: step.name,
          stepType: step.type as PerformanceWorkflowStepType,
          stepSnapshot: step as unknown as Prisma.InputJsonValue,
          rejectionStrategy: step.rejectionStrategy as PerformanceWorkflowRejectionStrategy | undefined,
          rejectionTargetStepId: step.rejectionTargetStepId,
          status: TaskStatus.IN_PROGRESS,
          executorNameSnapshot: executors.map((executor) => executor.name ?? executor.employeeNo).join('、'),
          executorResolvedAt: new Date(),
          assignees: {
            create: executors.map((executor) => ({
              employeeId: executor.id,
              userId: this.activeUser(executor.user)?.id ?? null,
              displayNameSnapshot: executor.name ?? executor.employeeNo,
              accountSnapshot: this.activeUser(executor.user)?.username ?? null,
              status: TaskStatus.IN_PROGRESS,
            })),
          },
        },
        include: { assignees: { include: { employee: { select: { workEmail: true, mobile: true } } } }, instance: { include: { cycle: true, employee: { select: { name: true } } } }, },
      });
      await tx.performanceInstance.update({ where: { id: instanceId }, data: { currentWorkflowOrder: manualStepIndex, status: ProcessStatus.IN_PROGRESS } });
      return created;
    });
    await this.notifyWorkflowTaskOpened(task);
  }

  private executorExecutionMode(executor: PerformanceWorkflowManualStepDefinition['executor'] | undefined) {
    if (!executor) throw new BadRequestException('流程步骤未配置执行人');
    return executor.executionMode ?? PerformanceExecutionMode.SINGLE;
  }

  private activeUser(user: { id: string; username: string; displayName: string; status: RecordStatus; archivedAt: Date | null } | null | undefined) {
    return user?.status === RecordStatus.ACTIVE && user.archivedAt === null ? user : null;
  }

  private async resolveWorkflowExecutors(step: PerformanceWorkflowManualStepDefinition, effectiveAt: Date) {
    const executor = step.executor;
    if (!executor) throw new BadRequestException(`流程步骤“${step.name}”未配置执行人`);
    const module = { name: step.name, executor } as PerformanceModuleDefinition;
    if (executor.type === PerformanceExecutorType.USER) return this.resolveExecutorEmployees(module, effectiveAt);
    if (executor.type !== PerformanceExecutorType.DIRECTORY) return [];
    const directoryFilter = executor.directoryType === PerformanceDirectoryType.POSITION
      ? { positionId: executor.directoryId }
      : { jobTitleId: executor.directoryId };
    const matches = await this.prisma.employee.findMany({
      where: {
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        assignments: {
          some: {
            ...directoryFilter,
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            isPrimary: true,
            startDate: { lte: effectiveAt },
            OR: [{ endDate: null }, { endDate: { gte: effectiveAt } }],
          },
        },
      },
      select: { id: true, name: true, employeeNo: true, workEmail: true, mobile: true, user: { select: { id: true, username: true, displayName: true, status: true, archivedAt: true } } },
    });
    if (matches.length !== 1) throw new BadRequestException(`流程步骤“${step.name}”岗位执行人必须唯一匹配一名有效在职人员`);
    return matches;
  }

  private async notifyWorkflowTaskOpened(task: any) {
    if (!this.feishuTaskSessions?.enabled) {
      await Promise.all((task.assignees ?? []).map((assignee: any) => this.deliverWorkflowCard(task, assignee)));
      return;
    }
    const employeeIds: string[] = [...new Set<string>((task.assignees ?? [])
      .map((assignee: any) => assignee.employeeId)
      .filter((id: unknown): id is string => typeof id === 'string' && Boolean(id)))];
    const cycleId: string | undefined = typeof task.instance?.cycleId === 'string'
      ? task.instance.cycleId
      : typeof task.instance?.cycle?.id === 'string' ? task.instance.cycle.id : undefined;
    if (!cycleId) return;
    await Promise.all(employeeIds.map((employeeId: string) => this.notifyFeishuTaskInbox(employeeId, cycleId)));
  }

  private async notifyFeishuTaskInbox(employeeId: string, cycleId: string) {
    if (!this.feishuTaskSessions?.enabled || !this.feishu.enabled) return;
    const key = `${cycleId}:${employeeId}`;
    const pending = this.inboxNotifications.get(key);
    if (pending) return pending;
    const notification = this.updateFeishuTaskInbox(employeeId, cycleId).finally(() => this.inboxNotifications.delete(key));
    this.inboxNotifications.set(key, notification);
    return notification;
  }

  private async updateFeishuTaskInbox(employeeId: string, cycleId: string) {
    const sessions = this.feishuTaskSessions;
    if (!sessions?.enabled) return;
    const inbox = await this.getFeishuTaskInbox(employeeId, cycleId);
    const existing = await this.prisma.performanceFeishuTaskInboxDelivery.findFirst({ where: { employeeId, cycleId } });
    if (inbox.totalPending === 0) {
      if (existing?.messageId) await this.feishu.updateCard(existing.messageId, this.feishuTaskInboxCompletedCard(inbox.cycleName));
      return;
    }
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { workEmail: true, mobile: true } });
    if (!employee) return;
    const openId = await this.feishu.resolveOpenIdByContact(employee);
    if (!openId) return;
    const state = await sessions.createState(employeeId, cycleId);
    if (!state) return;
    const url = sessions.authorizationUrl(state);
    if (!url) return;
    const session = await this.prisma.performanceFeishuTaskSession.findUnique({ where: { stateHash: createHash('sha256').update(state).digest('hex') }, select: { id: true } });
    if (!session) return;
    const card = this.feishuTaskInboxCard(inbox, url);
    if (existing?.messageId) {
      const updated = await this.feishu.updateCard(existing.messageId, card);
      await this.prisma.performanceFeishuTaskInboxDelivery.update({ where: { id: existing.id }, data: { sessionId: session.id, status: updated ? 'DELIVERED' : 'FAILED', deliveredAt: updated ? new Date() : existing.deliveredAt, failureReason: updated ? null : '飞书个人汇总卡片更新失败' } });
      return;
    }
    let delivery;
    try {
      delivery = await this.prisma.performanceFeishuTaskInboxDelivery.create({ data: { employeeId, cycleId, sessionId: session.id, status: 'PENDING' } });
    } catch {
      delivery = await this.prisma.performanceFeishuTaskInboxDelivery.findFirst({ where: { employeeId, cycleId } });
      if (!delivery) throw new ConflictException('飞书汇总通知状态发生变化，请重试');
    }
    const current = await this.prisma.performanceFeishuTaskInboxDelivery.findUnique({ where: { id: delivery.id }, select: { messageId: true } });
    if (current?.messageId) {
      const updated = await this.feishu.updateCard(current.messageId, card);
      await this.prisma.performanceFeishuTaskInboxDelivery.update({ where: { id: delivery.id }, data: { sessionId: session.id, status: updated ? 'DELIVERED' : 'FAILED', deliveredAt: updated ? new Date() : null, failureReason: updated ? null : '飞书个人汇总卡片更新失败' } });
      return;
    }
    const messageId = await this.feishu.sendCardMessageToOpenId(openId, card);
    await this.prisma.performanceFeishuTaskInboxDelivery.updateMany({ where: { id: delivery.id, messageId: null }, data: { messageId, status: messageId ? 'DELIVERED' : 'FAILED', deliveredAt: messageId ? new Date() : null, failureReason: messageId ? null : '飞书个人汇总卡片发送失败' } });
  }

  private feishuTaskInboxCompletedCard(cycleName: string): FeishuCard {
    return {
      schema: '2.0',
      config: { enable_forward: false },
      header: { title: { tag: 'plain_text', content: '绩效活动处理完成' }, template: 'green' },
      body: { elements: [{ tag: 'markdown', content: `**绩效活动**：${cycleName}\n当前活动暂无待处理事项。` }] },
    };
  }

  private feishuTaskInboxCard(inbox: Pick<PerformanceFeishuTaskInbox, 'cycleName' | 'totalPending' | 'assessmentTasks' | 'workflowTasks'>, url: string): FeishuCard {
    const assessmentCount = inbox.assessmentTasks.length;
    const workflowCount = inbox.workflowTasks.length;
    const workflowResults = inbox.workflowTasks.map((task) => (
      `- ${task.employeeName}（${task.employeeNo}）｜${task.stepName}\n  最终得分：${this.formatScore(task.finalScore)}｜实际金额：${this.formatMoney(task.actualAmount)}`
    ));
    return {
      schema: '2.0',
      config: { enable_forward: false },
      header: { title: { tag: 'plain_text', content: '绩效活动待处理提醒' }, template: 'blue' },
      body: { elements: [
        { tag: 'markdown', content: `**绩效活动**：${inbox.cycleName}\n**待提交评价**：${assessmentCount} 项\n**待审核/流程处理**：${workflowCount} 项\n**合计**：${inbox.totalPending} 项${workflowResults.length ? `\n\n**待审核结果**\n${workflowResults.join('\n')}` : ''}` },
        { tag: 'button', text: { tag: 'plain_text', content: '查看详情' }, type: 'primary', multi_url: { url } },
      ] },
    };
  }

  private workflowCard(task: any, cardToken: string) {
    const actionValue = { kind: 'workflow', token: cardToken };
    const actionElements = task.stepType === PerformanceWorkflowStepType.CONFIRMATION
      ? [{ tag: 'button', name: 'submit_confirm', text: { tag: 'plain_text', content: '确认结果' }, type: 'primary', form_action_type: 'submit', behaviors: [{ type: 'callback', value: { ...actionValue, action: 'CONFIRM' } }] }]
      : task.stepType === PerformanceWorkflowStepType.HR_ARCHIVE
        ? [{ tag: 'button', name: 'submit_archive', text: { tag: 'plain_text', content: '完成归档' }, type: 'primary', form_action_type: 'submit', behaviors: [{ type: 'callback', value: { ...actionValue, action: 'ARCHIVE' } }] }]
        : [
            { tag: 'button', name: 'submit_approve', text: { tag: 'plain_text', content: '通过' }, type: 'primary', form_action_type: 'submit', behaviors: [{ type: 'callback', value: { ...actionValue, action: 'APPROVE' } }] },
            { tag: 'button', name: 'submit_reject', text: { tag: 'plain_text', content: '驳回' }, type: 'danger', form_action_type: 'submit', behaviors: [{ type: 'callback', value: { ...actionValue, action: 'REJECT' } }] },
          ];
    return {
      schema: '2.0' as const,
      config: { enable_forward: false },
      header: { title: { tag: 'plain_text' as const, content: `绩效流程：${task.stepName}` }, template: 'blue' as const },
      body: {
        elements: [
          { tag: 'markdown', content: `**绩效活动**：${task.instance.cycle.name}\n**被考核人**：${task.instance.employee.name ?? '未命名员工'}\n**当前步骤**：${task.stepName}\n**最终得分**：${this.formatScore(this.number(task.instance.finalScore))}\n**实际金额**：${this.formatMoney(this.number(task.instance.actualAmount))}` },
          { tag: 'form', name: 'performance_workflow_action', elements: [
            { tag: 'input', name: 'comment', input_type: 'multiline_text', placeholder: { tag: 'plain_text', content: task.stepType === PerformanceWorkflowStepType.REVIEW || task.stepType === PerformanceWorkflowStepType.APPROVAL ? '处理意见；驳回时必填' : '处理说明（可选）' } },
            ...actionElements,
          ] },
        ],
      },
    };
  }

  private async notifyTaskOpened(taskId: string) {
    const task = await this.prisma.performanceModuleTask.findUnique({
      where: { id: taskId },
      include: { instance: { include: { cycle: true, employee: { select: { name: true } } } }, assignees: { where: { status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } }, include: { employee: { select: { workEmail: true, mobile: true } } } } },
    });
    if (!task || task.moduleType === PerformanceModuleType.METRIC) return;
    if (!this.feishuTaskSessions?.enabled) {
      await Promise.all(task.assignees.map((assignee) => this.deliverAssessmentCard(task, assignee)));
      return;
    }
    const employeeIds = [...new Set(task.assignees.map((assignee) => assignee.employeeId).filter((id): id is string => Boolean(id)))];
    await Promise.all(employeeIds.map((employeeId) => this.notifyFeishuTaskInbox(employeeId, task.instance.cycleId)));
  }

  private async deliverAssessmentCard(task: any, assignee: any) {
    const delivery = await this.prisma.performanceAssessmentNotificationDelivery.create({
      data: { assessmentAssigneeId: assignee.id, channel: 'FEISHU_CARD', status: 'PENDING' },
    });
    if (!this.feishu.enabled) return this.finishAssessmentDelivery(delivery.id, 'SKIPPED', '飞书个人通知未启用');
    if (!assignee.employee) return this.finishAssessmentDelivery(delivery.id, 'SKIPPED', '执行人缺少可用联系方式');
    const openId = await this.feishu.resolveOpenIdByContact(assignee.employee);
    if (!openId) return this.finishAssessmentDelivery(delivery.id, 'FAILED', '未匹配到唯一飞书个人账号');
    let cardToken: string | null = null;
    try {
      cardToken = await this.issueAssessmentCardToken(assignee.id);
      const delivered = await this.feishu.sendCardToOpenId(openId, this.assessmentCard(task, cardToken));
      if (!delivered) {
        await this.clearAssessmentCardToken(assignee.id, cardToken);
        return this.finishAssessmentDelivery(delivery.id, 'FAILED', '飞书个人卡片发送失败');
      }
      await this.prisma.performanceModuleTaskAssignee.updateMany({
        where: { id: assignee.id, cardTokenHash: this.hashCardToken(cardToken), cardConsumedAt: null },
        data: { cardIssuedAt: new Date() },
      });
      await this.audit.create({}, AuditAction.CREATE, delivery.id, { resource: 'performance-notification-delivery', taskId: task.id, assigneeId: assignee.id, status: 'DELIVERED' }, this.prisma, 'performance_notification_delivery');
      return this.finishAssessmentDelivery(delivery.id, 'DELIVERED');
    } catch {
      if (cardToken) await this.clearAssessmentCardToken(assignee.id, cardToken);
      return this.finishAssessmentDelivery(delivery.id, 'FAILED', '飞书个人卡片投递异常');
    }
  }

  private async deliverWorkflowCard(task: any, assignee: any) {
    const delivery = await this.prisma.performanceWorkflowNotificationDelivery.create({
      data: { workflowAssigneeId: assignee.id, channel: 'FEISHU_CARD', status: 'PENDING' },
    });
    if (!this.feishu.enabled) return this.finishWorkflowDelivery(delivery.id, 'SKIPPED', '飞书个人通知未启用');
    if (!assignee.employee) return this.finishWorkflowDelivery(delivery.id, 'SKIPPED', '执行人缺少可用联系方式');
    const openId = await this.feishu.resolveOpenIdByContact(assignee.employee);
    if (!openId) return this.finishWorkflowDelivery(delivery.id, 'FAILED', '未匹配到唯一飞书个人账号');
    let cardToken: string | null = null;
    try {
      cardToken = await this.issueWorkflowCardToken(assignee.id);
      const delivered = await this.feishu.sendCardToOpenId(openId, this.workflowCard(task, cardToken));
      if (!delivered) {
        await this.clearWorkflowCardToken(assignee.id, cardToken);
        return this.finishWorkflowDelivery(delivery.id, 'FAILED', '飞书个人卡片发送失败');
      }
      await this.prisma.performanceWorkflowTaskAssignee.updateMany({
        where: { id: assignee.id, cardTokenHash: this.hashCardToken(cardToken), cardConsumedAt: null },
        data: { cardIssuedAt: new Date() },
      });
      await this.audit.create({}, AuditAction.CREATE, delivery.id, { resource: 'performance-notification-delivery', taskId: task.id, assigneeId: assignee.id, status: 'DELIVERED' }, this.prisma, 'performance_notification_delivery');
      return this.finishWorkflowDelivery(delivery.id, 'DELIVERED');
    } catch {
      if (cardToken) await this.clearWorkflowCardToken(assignee.id, cardToken);
      return this.finishWorkflowDelivery(delivery.id, 'FAILED', '飞书个人卡片投递异常');
    }
  }

  private finishAssessmentDelivery(id: string, status: 'DELIVERED' | 'FAILED' | 'SKIPPED', failureReason?: string) {
    return this.prisma.performanceAssessmentNotificationDelivery.update({
      where: { id },
      data: { status, deliveredAt: status === 'DELIVERED' ? new Date() : null, failureReason: failureReason ?? null },
    });
  }

  private finishWorkflowDelivery(id: string, status: 'DELIVERED' | 'FAILED' | 'SKIPPED', failureReason?: string) {
    return this.prisma.performanceWorkflowNotificationDelivery.update({
      where: { id },
      data: { status, deliveredAt: status === 'DELIVERED' ? new Date() : null, failureReason: failureReason ?? null },
    });
  }

  private assessmentCard(task: any, cardToken: string) {
    const isAdjustment = task.moduleType === PerformanceModuleType.ADJUSTMENT;
    const module = task.moduleSnapshot as PerformanceModuleDefinition;
    const label = isAdjustment ? `调整分值（${module.adjustmentMin ?? 0}-${module.adjustmentMax ?? 0}）` : '评估分数（0-100）';
    const indicatorStandards = this.formatIndicatorStandards(module.indicators);
    return {
      schema: '2.0' as const,
      config: { enable_forward: false },
      header: { title: { tag: 'plain_text' as const, content: `绩效考核：${task.moduleName}` }, template: 'blue' as const },
      body: {
        elements: [
          { tag: 'markdown', content: `**绩效活动**：${task.instance.cycle.name}\n**被考核人**：${task.instance.employee.name ?? '未命名员工'}\n请提交${label}。评语可为空。` },
          ...(indicatorStandards ? [{ tag: 'markdown', content: indicatorStandards }] : []),
          { tag: 'form', name: 'performance_submission', elements: [
            { tag: 'input', name: 'value', placeholder: { tag: 'plain_text', content: label }, input_type: 'text' },
            { tag: 'input', name: 'comment', input_type: 'multiline_text', placeholder: { tag: 'plain_text', content: '评语（可选）' } },
            { tag: 'button', name: 'submit_score', text: { tag: 'plain_text', content: '提交评分' }, type: 'primary', form_action_type: 'submit', behaviors: [{ type: 'callback', value: { kind: 'assessment', token: cardToken, moduleType: task.moduleType } }] },
          ] },
        ],
      },
    };
  }

  private formatIndicatorStandards(indicators: PerformanceModuleDefinition['indicators'] | undefined) {
    const items = (indicators ?? [])
      .map((indicator) => {
        const description = indicator.description?.trim() ?? '';
        const standards = (Array.isArray(indicator.standards) ? indicator.standards : [])
          .map((standard) => standard.trim())
          .filter(Boolean);
        if (standards.length === 0 && !description) return '';
        const lines = [`**${indicator.name}**${description ? `：${description}` : ''}`];
        standards.forEach((standard) => lines.push(`- ${standard}`));
        return lines.join('\n');
      })
      .filter(Boolean);
    return items.length > 0 ? `**衡量标准**\n${items.join('\n\n')}` : '';
  }

  private hashCardToken(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async issueAssessmentCardToken(assigneeId: string) {
    const token = randomBytes(32).toString('base64url');
    const updated = await this.prisma.performanceModuleTaskAssignee.updateMany({
      where: { id: assigneeId, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } },
      // The token exists before sending, but the delivery timestamp is only
      // written after Feishu confirms the personal card was accepted.
      data: { cardTokenHash: this.hashCardToken(token), cardIssuedAt: null, cardConsumedAt: null },
    });
    if (updated.count !== 1) throw new ConflictException('绩效卡片处理人状态已变化');
    return token;
  }

  private async issueWorkflowCardToken(assigneeId: string) {
    const token = randomBytes(32).toString('base64url');
    const updated = await this.prisma.performanceWorkflowTaskAssignee.updateMany({
      where: { id: assigneeId, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } },
      // cardIssuedAt becomes a confirmed delivery timestamp only after the
      // provider accepts the personal card.
      data: { cardTokenHash: this.hashCardToken(token), cardIssuedAt: null, cardConsumedAt: null },
    });
    if (updated.count !== 1) throw new ConflictException('流程卡片处理人状态已变化');
    return token;
  }

  private async clearAssessmentCardToken(assigneeId: string, token: string) {
    await this.prisma.performanceModuleTaskAssignee.updateMany({
      where: { id: assigneeId, cardTokenHash: this.hashCardToken(token), cardConsumedAt: null },
      data: { cardTokenHash: null, cardIssuedAt: null },
    });
  }

  private async clearWorkflowCardToken(assigneeId: string, token: string) {
    await this.prisma.performanceWorkflowTaskAssignee.updateMany({
      where: { id: assigneeId, cardTokenHash: this.hashCardToken(token), cardConsumedAt: null },
      data: { cardTokenHash: null, cardIssuedAt: null },
    });
  }

  private configuredFrontendUrl() {
    return process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5173';
  }

  private async executeMetricTask(task: PerformanceTaskRecord, periodStart: Date, periodEnd: Date) {
    const module = task.moduleSnapshot as unknown as PerformanceModuleDefinition;
    if (module.indicators.length === 0) throw new BadRequestException(`业务指标模块“${module.name}”未配置指标`);
    const metrics = await this.adapter.getMetrics({ employeeId: task.employeeId, periodStart, periodEnd, indicators: module.indicators });
    if (metrics.length !== module.indicators.length) throw new BadRequestException(`业务指标模块“${module.name}”返回的指标数量不完整`);
    const details = metrics.map((metric) => {
      const indicator = module.indicators.find((item) => item.id === metric.indicatorId);
      if (!indicator) throw new BadRequestException(`业务适配器返回了未知指标：${metric.indicatorId}`);
      if (!Number.isFinite(metric.targetValue) || !Number.isFinite(metric.actualValue) || !Number.isFinite(metric.weight)) throw new BadRequestException(`指标“${indicator.name}”业务数据不是有限数字`);
      const completionRate = metric.targetValue === 0 ? (metric.actualValue === 0 ? 1 : 0) : metric.actualValue / metric.targetValue;
      const context: Record<string, number> = { completionRate, targetValue: metric.targetValue, actualValue: metric.actualValue, ...(metric.fields ?? {}) };
      // Business-field mappings and score rules are back-end adapter concerns.
      // The HR template never supplies executable rule text.
      if (indicator.dataField && !Number.isFinite(context[indicator.dataField])) throw new BadRequestException(`指标“${indicator.name}”缺少后端配置的业务数据字段：${indicator.dataField}`);
      const score = indicator.rule ? this.rules.evaluate(indicator.rule, context) : Math.min(100, Math.max(0, completionRate * 100));
      if (!Number.isFinite(score) || score < 0 || score > 100) throw new BadRequestException(`指标“${indicator.name}”计算得分必须在 0-100 范围内`);
      return { indicatorId: indicator.id, targetValue: metric.targetValue, actualValue: metric.actualValue, completionRate, weight: metric.weight, score };
    });
    const definitionWeights = new Map(module.indicators.map((indicator) => [indicator.id, indicator.weight]));
    if (details.some((item) => Math.abs(item.weight - (definitionWeights.get(item.indicatorId) ?? Number.NaN)) > 0.0001)) {
      throw new BadRequestException(`业务指标模块“${module.name}”返回的指标权重与模板定义不一致`);
    }
    const totalWeight = details.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.0001) throw new BadRequestException(`业务指标权重合计必须为 100%，当前为 ${totalWeight}%`);
    const moduleScore = details.reduce((sum, item) => sum + item.score * item.weight / 100, 0);
    await this.prisma.performanceModuleTask.update({ where: { id: task.id }, data: { status: TaskStatus.COMPLETED, rawData: metrics as unknown as Prisma.InputJsonValue, calculationDetails: details as unknown as Prisma.InputJsonValue, moduleScore: DECIMAL(moduleScore), completedAt: new Date() } });
    return moduleScore;
  }

  private async resolveTaskAssignees(task: PerformanceTaskRecord, effectiveAt: Date) {
    const module = task.moduleSnapshot as unknown as PerformanceModuleDefinition;
    if (task.executorType === PerformanceExecutorType.AUTO) return [];
    const existing = await this.prisma.performanceModuleTaskAssignee.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'asc' } });
    if (existing.length > 0) return existing;

    let directExecutors = task.executorType === PerformanceExecutorType.USER
      ? await this.resolveExecutorEmployees(module, effectiveAt)
      : [];
    if (task.executorType === PerformanceExecutorType.DIRECTORY) {
      const directoryFilter = task.executorDirectoryType === PerformanceDirectoryType.POSITION
        ? { positionId: task.executorDirectoryId }
        : { jobTitleId: task.executorDirectoryId };
      const matches = await this.prisma.employee.findMany({
        where: {
          recordStatus: RecordStatus.ACTIVE,
          archivedAt: null,
          assignments: {
            some: {
              ...directoryFilter,
              status: AssignmentStatus.ACTIVE,
              archivedAt: null,
              isPrimary: true,
              startDate: { lte: effectiveAt },
              OR: [{ endDate: null }, { endDate: { gte: effectiveAt } }],
            },
          },
        },
        select: { id: true, name: true, employeeNo: true, workEmail: true, mobile: true, user: { select: { id: true, username: true, displayName: true, status: true, archivedAt: true } } },
      });
      if (matches.length !== 1 || !matches[0]) throw new BadRequestException(`模块“${module.name}”岗位执行人必须唯一匹配一名有效在职人员`);
      directExecutors = [matches[0]];
    }
    if (directExecutors.length === 0) throw new BadRequestException(`模块“${module.name}”未指定执行人`);
    if (task.executionMode === PerformanceExecutionMode.SINGLE && directExecutors.length !== 1) throw new BadRequestException(`模块“${module.name}”单人执行必须唯一指定一名人员`);
    if (task.executionMode === PerformanceExecutionMode.MULTIPLE && directExecutors.length < 2) throw new BadRequestException(`模块“${module.name}”多人执行必须指定至少两名人员`);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.performanceModuleTaskAssignee.createMany({
        data: directExecutors.map((executor) => ({
          taskId: task.id,
          employeeId: executor.id,
          userId: executor.user?.status === RecordStatus.ACTIVE && executor.user.archivedAt === null ? executor.user.id : null,
          displayNameSnapshot: executor.name ?? executor.employeeNo,
          accountSnapshot: executor.user?.status === RecordStatus.ACTIVE && executor.user.archivedAt === null ? executor.user.username : null,
          status: TaskStatus.IN_PROGRESS,
        })),
        skipDuplicates: true,
      });
      const primary = directExecutors[0]!;
      const primaryUser = primary.user?.status === RecordStatus.ACTIVE && primary.user.archivedAt === null ? primary.user : null;
      await tx.performanceModuleTask.update({
        where: { id: task.id },
        data: {
          executorUserId: task.executionMode === PerformanceExecutionMode.SINGLE ? primaryUser?.id ?? null : null,
          executorNameSnapshot: task.executionMode === PerformanceExecutionMode.SINGLE ? (primary.name ?? primary.employeeNo) : directExecutors.map((executor) => executor.name ?? executor.employeeNo).join('、'),
          executorAccountSnapshot: task.executionMode === PerformanceExecutionMode.SINGLE ? primaryUser?.username ?? null : null,
          executorResolvedAt: new Date(),
        },
      });
      return tx.performanceModuleTaskAssignee.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'asc' } });
    });
    return result;
  }

  private isTaskAssignee(task: { executorUserId: string | null; assignees?: Array<{ userId: string | null }> }, userId: string) {
    if (task.assignees?.length) return task.assignees.some((item) => item.userId === userId);
    return task.executorUserId === userId;
  }

  private verifyFeishuCallback(
    body: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Record<string, any> {
    const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;
    const encryptionKey = process.env.FEISHU_ENCRYPT_KEY;
    const headerValue = (name: string) => {
      const value = headers[name] ?? headers[name.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    };
    if (encryptionKey) {
      const timestamp = headerValue('x-lark-request-timestamp');
      const nonce = headerValue('x-lark-request-nonce');
      const signature = headerValue('x-lark-signature');
      if (!timestamp || !nonce || !signature) throw new UnauthorizedException('飞书回调缺少签名请求头');
      const expected = createHash('sha256').update(Buffer.concat([
        Buffer.from(timestamp),
        Buffer.from(nonce),
        Buffer.from(encryptionKey),
        rawBody,
      ])).digest('hex');
      const expectedBuffer = Buffer.from(expected, 'hex');
      const signatureBuffer = /^[a-f0-9]+$/i.test(signature) ? Buffer.from(signature, 'hex') : Buffer.alloc(0);
      if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
        throw new UnauthorizedException('飞书回调签名无效');
      }
    }
    let payload = body as Record<string, any>;
    if (typeof payload.encrypt === 'string') {
      if (!encryptionKey) throw new UnauthorizedException('收到加密飞书回调但未配置 Encrypt Key');
      try {
        const encrypted = Buffer.from(payload.encrypt, 'base64');
        if (encrypted.length <= 16) throw new Error('ciphertext too short');
        const key = createHash('sha256').update(encryptionKey).digest();
        const decipher = createDecipheriv('aes-256-cbc', key, encrypted.subarray(0, 16));
        const plaintext = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]).toString('utf8');
        payload = JSON.parse(plaintext) as Record<string, any>;
      } catch {
        throw new UnauthorizedException('飞书加密回调无法解密');
      }
    }
    const token = payload.token ?? payload.header?.token;
    if (verificationToken && token !== verificationToken) throw new UnauthorizedException('飞书回调验证令牌无效');
    if (!verificationToken && !encryptionKey) throw new UnauthorizedException('未配置飞书回调验证参数');
    return payload;
  }

  private cardActionPayload(payload: Record<string, any>) {
    const value = payload.event?.action?.value
      ?? payload.event?.action?.actions?.[0]?.value
      ?? payload.action?.value
      ?? payload.action?.actions?.[0]?.value;
    const normalized = this.cardActionValue(value);
    if (!normalized || typeof normalized.kind !== 'string' || typeof normalized.token !== 'string') return null;
    return normalized as { kind: 'assessment' | 'workflow'; token: string; action?: PerformanceWorkflowAction; moduleType?: PerformanceModuleType };
  }

  private cardActionValue(value: unknown): Record<string, unknown> | null {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  private cardOperatorOpenId(payload: Record<string, any>) {
    const openId = payload.event?.operator?.open_id
      ?? payload.event?.operator?.user_id
      ?? payload.event?.operator_id?.open_id
      ?? payload.open_id
      ?? payload.operator?.open_id;
    return typeof openId === 'string' && openId ? openId : null;
  }

  private cardCallbackEventId(payload: Record<string, any>) {
    const eventId = payload.header?.event_id ?? payload.event_id ?? payload.event?.event_id;
    return typeof eventId === 'string' && eventId ? eventId : undefined;
  }

  private cardMessageId(payload: Record<string, any>) {
    const messageId = payload.event?.context?.open_message_id
      ?? payload.event?.open_message_id
      ?? payload.open_message_id
      ?? payload.message_id;
    return typeof messageId === 'string' && messageId ? messageId : null;
  }

  private submittedAssessmentCard(task: PerformanceTaskRecord, score: number, comment: string | undefined): FeishuCard {
    return {
      schema: '2.0',
      config: { enable_forward: false },
      header: { title: { tag: 'plain_text', content: `绩效考核：${task.moduleName}` }, template: 'green' },
      body: {
        elements: [{
          tag: 'markdown',
          content: `**已提交评分**\n\n**分数**：${score}\n**评语**：${comment?.trim() || '未填写'}\n\n该卡片已完成，重复操作不会再次写入绩效数据。`,
        }],
      },
    };
  }

  private cardFormValue(payload: Record<string, any>, name: string) {
    const formValue = payload.event?.action?.form_value
      ?? payload.event?.action?.form_values
      ?? payload.action?.form_value
      ?? payload.action?.form_values
      ?? {};
    const fields = typeof formValue === 'string' ? this.cardActionValue(formValue) ?? {} : formValue;
    const value = fields[name];
    return typeof value === 'string' ? value.trim() : '';
  }

  private async assertFeishuEmployeeIdentity(employee: { workEmail: string | null; mobile: string | null }, openId: string) {
    const resolvedOpenId = await this.feishu.resolveOpenIdByContact(employee);
    if (!resolvedOpenId || resolvedOpenId !== openId) throw new UnauthorizedException('飞书操作人不匹配当前任务处理人');
  }

  private async submitAssessmentCardAction(
    action: { token: string; moduleType?: PerformanceModuleType; value?: string; comment?: string },
    openId: string,
    callbackEventId: string | undefined,
    messageId?: string | null,
  ) {
    const assignee = await this.prisma.performanceModuleTaskAssignee.findFirst({
      where: { cardTokenHash: this.hashCardToken(action.token), cardConsumedAt: null, status: TaskStatus.IN_PROGRESS },
      include: {
        employee: { select: { workEmail: true, mobile: true } },
        task: { include: { instance: { include: { cycle: true, tasks: { orderBy: { moduleOrder: 'asc' } } } }, assignees: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!assignee?.employee) throw new ConflictException('飞书评分卡片已过期或已处理');
    await this.assertFeishuEmployeeIdentity(assignee.employee, openId);
    const parsedValue = Number(action.value);
    const comment = action.comment;
    if (!Number.isFinite(parsedValue)) throw new BadRequestException('飞书卡片分数必须是有限数字');
    const task = assignee.task as unknown as PerformanceTaskRecord;
    if (task.moduleType === PerformanceModuleType.METRIC) throw new BadRequestException('业务指标模块由系统自动计算');
    const module = task.moduleSnapshot as unknown as PerformanceModuleDefinition;
    if (task.moduleType === PerformanceModuleType.EVALUATION && (parsedValue < 0 || parsedValue > 100)) throw new BadRequestException('人工评估模块分数必须在 0-100 范围内');
    if (task.moduleType === PerformanceModuleType.ADJUSTMENT && (parsedValue < (module.adjustmentMin ?? 0) || parsedValue > (module.adjustmentMax ?? module.adjustmentMin ?? 0))) throw new BadRequestException(`调整分值必须在 ${module.adjustmentMin ?? 0}-${module.adjustmentMax ?? module.adjustmentMin ?? 0} 范围内`);
    await this.submitAssessmentAssigneeScore(task, assignee as PerformanceTaskAssigneeRecord, parsedValue, { score: task.moduleType === PerformanceModuleType.EVALUATION ? parsedValue : undefined, adjustment: task.moduleType === PerformanceModuleType.ADJUSTMENT ? parsedValue : undefined, comment: comment?.trim() || undefined }, callbackEventId);
    if (messageId) {
      const updated = await this.feishu.updateCard(messageId, this.submittedAssessmentCard(task, parsedValue, comment));
      if (!updated) {
        await this.audit.create({}, AuditAction.UPDATE, assignee.id, { resource: 'performance-task-assignee', action: 'update-feishu-card-failed' }, this.prisma, 'performance_module_task_assignee');
      }
    }
  }

  private async submitAssessmentAssigneeScore(
    task: PerformanceTaskRecord,
    assignee: PerformanceTaskAssigneeRecord,
    score: number,
    submission: Record<string, unknown>,
    callbackEventId: string | undefined,
  ) {
    const submittedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (callbackEventId) {
        const duplicate = await tx.auditLog.findFirst({ where: { resourceType: 'performance-feishu-card-callback', resourceId: callbackEventId } });
        if (duplicate) throw new ConflictException('飞书回调已处理');
      }
      const updated = await tx.performanceModuleTaskAssignee.updateMany({
        where: { id: assignee.id, status: TaskStatus.IN_PROGRESS, cardConsumedAt: null },
        data: { status: TaskStatus.COMPLETED, score: DECIMAL(score), submission: submission as Prisma.InputJsonValue, completedAt: submittedAt, cardConsumedAt: submittedAt },
      });
      if (updated.count !== 1) throw new ConflictException('当前执行人已经提交过此模块');
      await this.audit.create({}, AuditAction.UPDATE, assignee.id, { resource: 'performance-task-assignee', taskId: task.id, action: 'submit-feishu', score, callbackEventId }, tx, 'performance_module_task_assignee');
      if (callbackEventId) {
        await this.audit.create({}, AuditAction.UPDATE, callbackEventId, { taskId: task.id, assigneeId: assignee.id }, tx, 'performance-feishu-card-callback');
      }
    });
    const assignees = await this.prisma.performanceModuleTaskAssignee.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'asc' } });
    if (assignees.some((item) => item.status !== TaskStatus.COMPLETED || item.score === null)) return;
    const moduleScore = assignees.reduce((sum, item) => sum + Number(item.score), 0) / assignees.length;
    await this.completeTask(task, {} as AuthenticatedUser, moduleScore, {
      executionMode: task.executionMode,
      aggregation: 'AVERAGE',
      assigneeCount: assignees.length,
      assignees: assignees.map((item) => ({ employeeId: item.employeeId, displayName: item.displayNameSnapshot, score: Number(item.score), submission: item.submission })),
    });
  }

  private async submitWorkflowCardAction(
    action: { token: string; action?: PerformanceWorkflowAction; comment?: string },
    openId: string,
    callbackEventId: string | undefined,
  ) {
    if (!action.action) throw new BadRequestException('飞书流程卡片缺少处理动作');
    const assignee = await this.prisma.performanceWorkflowTaskAssignee.findFirst({
      where: { cardTokenHash: this.hashCardToken(action.token), cardConsumedAt: null, status: TaskStatus.IN_PROGRESS },
      include: {
        employee: { select: { workEmail: true, mobile: true } },
        task: { include: { instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } } } }, assignees: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!assignee?.employee) throw new ConflictException('飞书流程卡片已过期或已处理');
    await this.assertFeishuEmployeeIdentity(assignee.employee, openId);
    await this.performWorkflowAction(
      assignee.task as unknown as PerformanceWorkflowTaskRecord,
      assignee as PerformanceWorkflowTaskAssigneeRecord,
      action.action,
      action.comment,
      PerformanceWorkflowActionSource.FEISHU,
      null,
      callbackEventId,
    );
  }

  private async resolveEmployeeAmountBaseSnapshot(employeeId: string, finalScore: number) {
    const amountBase = await this.prisma.employeePerformanceAmountBase.findFirst({ where: { employeeId, replacedAt: null }, orderBy: { versionNo: 'desc' } });
    if (!amountBase) throw new BadRequestException('请先在绩效活动人员列表中为该员工填写金额基数');
    return {
      employeeAmountBaseId: amountBase.id,
      employeeAmountBaseSnapshot: amountBase.amount,
      employeeAmountBaseVersionNo: amountBase.versionNo,
      actualAmount: MONEY(Number(amountBase.amount) * finalScore / 100),
    };
  }

  private cycleInclude(options: { includeTemplateVersion?: boolean } = {}) {
    return {
      organization: { select: { id: true, name: true } },
      template: { select: { name: true } },
      ...(options.includeTemplateVersion === false ? {} : { templateVersion: { select: { versionNo: true } } }),
      createdBy: { select: { displayName: true } },
      exceptionHandlerEmployee: { select: { id: true, name: true, employeeNo: true } },
      _count: { select: { instances: true } },
    } as const;
  }

  private async findAccessibleExceptionHandler(user: AuthenticatedUser, employeeId: string) {
    const accessibleOrganizationIds = await this.access.getAccessibleOrganizationIds(user);
    const now = new Date();
    return this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        assignments: {
          some: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            isPrimary: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
            ...(accessibleOrganizationIds === null ? {} : { organizationId: { in: accessibleOrganizationIds } }),
          },
        },
      },
      select: { id: true },
    });
  }

  private async assertEmployeeAmountBaseScope(user: AuthenticatedUser, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, assignments: { where: { status: AssignmentStatus.ACTIVE, archivedAt: null, isPrimary: true, endDate: null }, select: { organizationId: true }, take: 1 } } });
    if (!employee) throw new NotFoundException('员工不存在');
    if (this.access.hasAllEmployeeData(user)) return;
    const scope = await this.access.getAccessibleOrganizationIds(user);
    const organizationId = employee.assignments[0]?.organizationId;
    if (!organizationId || !scope?.includes(organizationId)) throw new ForbiddenException('员工不在当前账号数据范围内');
  }

  private presentTemplate(row: any) {
    const version = row.versions[0];
    const latestVersion = version ? this.presentVersionSummary(version) : null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      latestVersion,
      configurationStatus: latestVersion?.status === PerformanceVersionStatus.PUBLISHED
        ? 'PUBLISHED'
        : latestVersion ? 'DRAFT' : 'NOT_CONFIGURED',
      moduleCount: this.moduleCount(version?.definition),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private presentTemplateDetail(row: any) { return { ...this.presentTemplate({ ...row, versions: row.versions }), versions: row.versions.map((version: any) => ({ ...this.presentVersionSummary(version), sourceMarkdown: version.sourceMarkdown, definition: version.definition })) }; }
  private presentVersion(version: any) { return { ...this.presentVersionSummary(version), sourceMarkdown: version.sourceMarkdown, definition: version.definition }; }
  private presentVersionSummary(version: any) { return { id: version.id, versionNo: version.versionNo, status: version.status, sourceType: version.sourceType, sourceName: version.sourceName, createdAt: version.createdAt.toISOString(), publishedAt: version.publishedAt?.toISOString() ?? null }; }
  private presentCycle(row: any) {
    return {
      id: row.id,
      name: row.name,
      organizationId: row.organizationId ?? null,
      organizationName: row.organization?.name ?? null,
      isPublic: row.isPublic ?? false,
      linkedLevel: row.linkedLevel ?? true,
      year: row.year ?? null,
      periodType: row.periodType ?? null,
      exceptionHandlerType: row.exceptionHandlerType ?? null,
      exceptionHandlerEmployeeId: row.exceptionHandlerEmployeeId ?? null,
      exceptionHandlerName: row.exceptionHandlerEmployee?.name ?? null,
      exceptionHandlerEmployeeNo: row.exceptionHandlerEmployee?.employeeNo ?? null,
      lockRelation: row.lockRelation ?? false,
      periodStart: this.date(row.periodStart),
      periodEnd: this.date(row.periodEnd),
      templateName: row.template?.name ?? '',
      templateVersionNo: row.templateVersion?.versionNo ?? 0,
      createdByName: row.createdBy?.displayName ?? null,
      status: row.status,
      instanceCount: row._count?.instances ?? row.instances?.length ?? 0,
      completedInstanceCount: row.instances?.filter((instance: any) => instance.status === ProcessStatus.COMPLETED).length ?? 0,
      createdAt: row.createdAt.toISOString(),
    };
  }
  private presentAssessmentDetailModule(task: any) {
    const module = task.moduleSnapshot as PerformanceModuleDefinition;
    const moduleScore = this.number(task.moduleScore);
    const moduleWeight = this.number(task.moduleWeight);
    const scorerNames = (task.assignees ?? []).map((assignee: any) => assignee.displayNameSnapshot).filter(Boolean);
    const metricDetails = Array.isArray(task.calculationDetails) ? task.calculationDetails as Array<Record<string, unknown>> : [];
    const indicators = (module.indicators ?? []).map((indicator) => {
      const metricDetail = metricDetails.find((detail) => detail.indicatorId === indicator.id);
      const rawScore = task.moduleType === PerformanceModuleType.METRIC && typeof metricDetail?.score === 'number'
        ? metricDetail.score
        : null;
      const indicatorWeight = typeof indicator.weight === 'number' ? indicator.weight : null;
      const weightedScore = rawScore === null || indicatorWeight === null ? null : this.round(rawScore * indicatorWeight / 100, 4);
      return {
        id: indicator.id,
        name: indicator.name,
        description: indicator.description ?? '',
        standards: indicator.standards ?? [],
        moduleName: task.moduleName,
        moduleType: task.moduleType,
        scorerNames,
        rawScore,
        indicatorWeight,
        weightedScore,
        scoreStatus: task.status,
        scoreSource: task.moduleType === PerformanceModuleType.METRIC ? 'METRIC' : 'UNAVAILABLE',
      };
    });
    return {
      id: task.id,
      name: task.moduleName,
      type: task.moduleType,
      weight: moduleWeight,
      status: task.status,
      scorerNames,
      moduleScore,
      weightedScore: moduleScore === null || moduleWeight === null || task.moduleType === PerformanceModuleType.ADJUSTMENT
        ? null
        : this.round(moduleScore * moduleWeight / 100, 4),
      adjustmentDirection: task.moduleType === PerformanceModuleType.ADJUSTMENT ? module.adjustmentDirection ?? null : null,
      indicators,
    };
  }

  private presentNotificationDelivery(delivery: any) {
    return {
      id: delivery.id,
      channel: delivery.channel,
      status: delivery.status,
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
      failureReason: delivery.failureReason ?? null,
      createdAt: delivery.createdAt.toISOString(),
    };
  }

  private presentFlowAssignee(assignee: any, role: string | null) {
    const deliveries = (assignee.notificationDeliveries ?? []).map((delivery: any) => this.presentNotificationDelivery(delivery));
    const latestDelivery = deliveries.at(-1) ?? null;
    return {
      id: assignee.id,
      employeeId: assignee.employeeId ?? null,
      displayName: assignee.displayNameSnapshot,
      role,
      status: assignee.status,
      deliveredAt: latestDelivery?.deliveredAt ?? null,
      deliveryStatus: latestDelivery?.status ?? null,
      deliveryFailureReason: latestDelivery?.failureReason ?? null,
      submittedAt: assignee.completedAt?.toISOString() ?? null,
      // No approved global qualification threshold exists for current templates.
      isQualified: null,
      deliveries,
    };
  }

  private executorRole(executor: unknown) {
    if (!this.isRecord(executor)) return null;
    if (executor.type === PerformanceExecutorType.DIRECTORY) {
      return executor.directoryType === PerformanceDirectoryType.POSITION ? '指定职位' : '指定职务';
    }
    return executor.type === PerformanceExecutorType.USER ? '指定人员' : null;
  }

  private presentAssessmentFlowStep(row: any) {
    const snapshot = row.moduleSnapshot as PerformanceModuleDefinition;
    const role = this.executorRole(snapshot?.executor);
    return {
      id: `assessment:${row.id}`,
      source: 'ASSESSMENT' as const,
      name: row.moduleName,
      type: row.moduleType,
      stepOrder: row.moduleOrder,
      attemptNo: 1,
      status: row.status,
      role,
      completedAt: row.completedAt?.toISOString() ?? null,
      isQualified: null,
      assignees: (row.assignees ?? []).map((assignee: any) => this.presentFlowAssignee(assignee, role)),
    };
  }

  private presentWorkflowFlowStep(row: any) {
    const snapshot = row.stepSnapshot as PerformanceWorkflowManualStepDefinition;
    const role = this.executorRole(snapshot?.executor);
    return {
      id: `workflow:${row.id}`,
      source: 'WORKFLOW' as const,
      name: row.stepName,
      type: row.stepType,
      stepOrder: row.stepOrder,
      attemptNo: row.attemptNo,
      status: row.status,
      role,
      completedAt: row.completedAt?.toISOString() ?? null,
      isQualified: null,
      assignees: (row.assignees ?? []).map((assignee: any) => this.presentFlowAssignee(assignee, role)),
    };
  }

  private presentWorkflowTask(row: any, currentUserId?: string) {
    const current = row.instance?.currentWorkflowOrder === row.stepOrder && row.status === TaskStatus.IN_PROGRESS;
    const assignees = (row.assignees ?? []).map((assignee: any) => ({
      id: assignee.id,
      employeeId: assignee.employeeId,
      userId: assignee.userId ?? null,
      displayName: assignee.displayNameSnapshot,
      username: assignee.accountSnapshot ?? null,
      status: assignee.status,
      completedAt: assignee.completedAt?.toISOString() ?? null,
    }));
    return {
      id: row.id,
      cycleId: row.instance?.cycleId,
      cycleName: row.instance?.cycle?.name ?? '',
      instanceId: row.instanceId,
      employeeId: row.instance?.employeeId ?? '',
      employeeName: row.instance?.employee?.name ?? '',
      employeeNo: row.instance?.employee?.employeeNo ?? '',
      stepId: row.stepId,
      stepName: row.stepName,
      stepType: row.stepType,
      stepOrder: row.stepOrder,
      attemptNo: row.attemptNo,
      status: row.status,
      executorName: (assignees.map((assignee: { displayName: string }) => assignee.displayName).join('、') || row.executorNameSnapshot) ?? null,
      finalScore: this.number(row.instance?.finalScore),
      actualAmount: this.number(row.instance?.actualAmount),
      assignees,
      isCurrent: current,
      canSubmit: current && Boolean(currentUserId && assignees.some((assignee: { userId: string | null; status: TaskStatus }) => assignee.userId === currentUserId && assignee.status !== TaskStatus.COMPLETED)),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private presentTask(row: any, currentUserId?: string) {
    const current = row.instance?.currentModuleOrder === row.moduleOrder && row.status === TaskStatus.IN_PROGRESS;
    const assignees = (row.assignees ?? []).map((assignee: any) => ({
      id: assignee.id,
      employeeId: assignee.employeeId ?? null,
      userId: assignee.userId ?? null,
      displayName: assignee.displayNameSnapshot,
      username: assignee.accountSnapshot ?? null,
      status: assignee.status,
      score: this.number(assignee.score),
      submission: assignee.submission,
      completedAt: assignee.completedAt?.toISOString() ?? null,
    }));
    const executorName = assignees.length > 0
      ? assignees.map((assignee: { displayName: string }) => assignee.displayName).join('、')
      : row.executorNameSnapshot ?? row.executorUser?.displayName ?? null;
    return {
      id: row.id,
      cycleId: row.instance?.cycleId,
      cycleName: row.instance?.cycle?.name ?? '',
      instanceId: row.instanceId,
      employeeId: row.employeeId,
      employeeName: row.instance?.employee?.name ?? '',
      employeeNo: row.instance?.employee?.employeeNo ?? '',
      moduleId: row.moduleId,
      moduleName: row.moduleName,
      moduleType: row.moduleType,
      moduleOrder: row.moduleOrder,
      moduleWeight: this.number(row.moduleWeight),
      executionMode: row.executionMode ?? PerformanceExecutionMode.SINGLE,
      status: row.status,
      executorName,
      assignees,
      isCurrent: current,
      canSubmit: current && Boolean(currentUserId && this.isTaskAssignee(row, currentUserId) && !assignees.some((assignee: { userId: string | null; status: TaskStatus }) => assignee.userId === currentUserId && assignee.status === TaskStatus.COMPLETED)),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
  private presentResult(row: any) { return { id: row.id, cycleId: row.cycleId, cycleName: row.cycle?.name ?? '', employeeId: row.employeeId, employeeName: row.employee?.name ?? '', employeeNo: row.employee?.employeeNo ?? '', finalScore: this.number(row.finalScore), employeeAmountBaseSnapshot: this.number(row.employeeAmountBaseSnapshot), employeeAmountBaseVersionNo: row.employeeAmountBaseVersionNo ?? null, actualAmount: this.number(row.actualAmount), assessmentStatus: row.assessmentStatus ?? null, assessmentCompletedAt: row.assessmentCompletedAt?.toISOString() ?? null, workflowCompletedAt: row.workflowCompletedAt?.toISOString() ?? null, status: row.status, revisionCount: row.revisions?.length ?? 0 }; }
  private presentEmployeeAmountBase(row: any) { return { id: row.id, employeeId: row.employeeId, employeeNo: row.employee.employeeNo, employeeName: row.employee.name ?? '', organizationName: row.employee.assignments[0]?.organization?.name ?? null, versionNo: row.versionNo, amount: this.number(row.amount)!, effectiveAt: row.versionNo === 0 ? null : row.effectiveAt.toISOString(), replacedAt: row.replacedAt?.toISOString() ?? null, changedByName: row.changedBy?.displayName ?? null, changeReason: row.changeReason || null, createdAt: row.versionNo === 0 ? null : row.createdAt.toISOString() }; }
  private async assertCycleScope(user: AuthenticatedUser, instances: Array<{ organizationId: string | null }>, cycleOrganizationId?: string | null) {
    if (this.access.hasAllEmployeeData(user)) return;
    const scope = await this.access.getAccessibleOrganizationIds(user);
    if (cycleOrganizationId && scope?.includes(cycleOrganizationId)) return;
    if (instances.some((instance) => !instance.organizationId || !scope?.includes(instance.organizationId))) throw new ForbiddenException('绩效周期不在当前账号数据范围内');
  }

  private templateNameFromDefinition(definition: unknown) { return this.isRecord(definition) && typeof definition.name === 'string' ? definition.name : ''; }
  private moduleCount(definition: unknown) { return this.isRecord(definition) && Array.isArray(definition.modules) ? definition.modules.length : 0; }
  private formatScore(value: number | null | undefined) { return value === null || value === undefined ? '--' : value.toFixed(4); }
  private formatMoney(value: number | null | undefined) { return value === null || value === undefined ? '--' : value.toFixed(2); }
  private number(value: Prisma.Decimal | null | undefined) { return value === null || value === undefined ? null : Number(value); }
  private round(value: number, decimals: number) { return Number(value.toFixed(decimals)); }
  private date(value: Date) { return value.toISOString().slice(0, 10); }
  private parseDate(value: string) { const date = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(date.getTime())) throw new BadRequestException('日期格式无效'); return date; }
  private assertDatabaseMode() { if (this.demo.enabled) throw new ConflictException('绩效模块仅支持数据库模式'); }
  private isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
}
