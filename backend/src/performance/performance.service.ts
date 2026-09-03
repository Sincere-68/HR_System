import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssignmentStatus,
  AuditAction,
  PerformanceDirectoryType,
  PerformanceExecutorType,
  PerformanceModuleType,
  PerformanceVersionStatus,
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
import { PrismaService } from '../prisma/prisma.service';
import { PERFORMANCE_DATA_ADAPTER, type PerformanceDataAdapter } from './performance-data.adapter';
import { PerformanceRuleEngine } from './performance-rule-engine';
import { PerformanceTemplateParser } from './performance-template.parser';
import {
  CreatePerformanceCycleDto,
  CreatePerformanceTemplateDto,
  ModifyPerformanceResultDto,
  ParsePerformanceTemplateDto,
  PerformanceTaskSubmissionDto,
  QueryPerformanceDto,
  UpdatePerformanceAmountBaseDto,
} from './dto/performance.dto';
import type { PerformanceModuleDefinition } from '@hr-demo/shared';

const DECIMAL = (value: number) => new Prisma.Decimal(value.toFixed(4));
const MONEY = (value: number) => new Prisma.Decimal(value.toFixed(2));

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
  executorUserId: string | null;
  executorDirectoryType: PerformanceDirectoryType | null;
  executorDirectoryId: string | null;
  executorNameSnapshot: string | null;
  executorAccountSnapshot: string | null;
  executorResolvedAt: Date | null;
  status: TaskStatus;
  rawData: Prisma.JsonValue | null;
  calculationDetails: Prisma.JsonValue | null;
  submission: Prisma.JsonValue | null;
  moduleScore: Prisma.Decimal | null;
  completedAt: Date | null;
  instance?: {
    cycle: { periodStart: Date };
    currentModuleOrder: number | null;
    tasks: PerformanceTaskRecord[];
  };
};

@Injectable()
export class PerformanceService {
  private readonly adapter: PerformanceDataAdapter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly audit: AuditService,
    private readonly demo: DemoDataService,
    private readonly parser: PerformanceTemplateParser,
    private readonly rules: PerformanceRuleEngine,
    @Inject(PERFORMANCE_DATA_ADAPTER) adapter: PerformanceDataAdapter,
  ) {
    this.adapter = adapter;
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
    const row = await this.prisma.$transaction(async (tx) => {
      const template = await tx.performanceTemplate.create({
        data: { name: dto.name.trim(), description: dto.description?.trim() || null, createdById: user.id },
      });
      await tx.performanceTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNo: 1,
          sourceName: dto.sourceName?.trim() || null,
          sourceMarkdown: dto.sourceMarkdown,
          definition: definition as unknown as Prisma.InputJsonValue,
          createdById: user.id,
        },
      });
      await this.audit.create({ userId: user.id }, AuditAction.CREATE, template.id, { resource: 'performance-template', versionNo: 1 }, tx, 'performance_template');
      return tx.performanceTemplate.findUniqueOrThrow({ where: { id: template.id }, include: { versions: true } });
    });
    return this.presentTemplateDetail(row);
  }

  async createTemplateVersion(user: AuthenticatedUser, templateId: string, dto: CreatePerformanceTemplateDto) {
    this.assertDatabaseMode();
    const template = await this.prisma.performanceTemplate.findFirst({ where: { id: templateId, status: RecordStatus.ACTIVE, archivedAt: null } });
    if (!template) throw new NotFoundException('绩效模板不存在');
    const definition = this.assertTemplatePayload(dto);
    const latest = await this.prisma.performanceTemplateVersion.findFirst({ where: { templateId }, orderBy: { versionNo: 'desc' } });
    const row = await this.prisma.$transaction(async (tx) => {
      const version = await tx.performanceTemplateVersion.create({
        data: {
          templateId,
          versionNo: (latest?.versionNo ?? 0) + 1,
          sourceName: dto.sourceName?.trim() || null,
          sourceMarkdown: dto.sourceMarkdown,
          definition: definition as unknown as Prisma.InputJsonValue,
          createdById: user.id,
        },
      });
      await tx.performanceTemplate.update({ where: { id: templateId }, data: { name: dto.name.trim(), description: dto.description?.trim() || null } });
      await this.audit.create({ userId: user.id }, AuditAction.CREATE, version.id, { resource: 'performance-template-version', templateId, versionNo: version.versionNo }, tx, 'performance_template_version');
      return version;
    });
    return this.presentVersion(row);
  }

  async publishTemplateVersion(user: AuthenticatedUser, templateId: string, versionId: string) {
    this.assertDatabaseMode();
    const version = await this.prisma.performanceTemplateVersion.findFirst({ where: { id: versionId, templateId } });
    if (!version) throw new NotFoundException('绩效模板版本不存在');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.performanceTemplateVersion.updateMany({ where: { templateId, status: PerformanceVersionStatus.PUBLISHED }, data: { status: PerformanceVersionStatus.ARCHIVED } });
      const published = await tx.performanceTemplateVersion.update({ where: { id: versionId }, data: { status: PerformanceVersionStatus.PUBLISHED, publishedAt: new Date() } });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, versionId, { resource: 'performance-template-version', action: 'publish' }, tx, 'performance_template_version');
      return published;
    });
    return this.presentVersion(result);
  }

  async getOptions() {
    this.assertDatabaseMode();
    const [users, positions, jobTitles] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where: { status: RecordStatus.ACTIVE, archivedAt: null }, select: { id: true, username: true, displayName: true, employeeId: true }, orderBy: [{ displayName: 'asc' }, { id: 'asc' }] }),
      this.prisma.position.findMany({ where: { status: RecordStatus.ACTIVE, archivedAt: null }, select: { id: true, code: true, name: true }, orderBy: [{ name: 'asc' }, { code: 'asc' }] }),
      this.prisma.jobTitle.findMany({ where: { status: RecordStatus.ACTIVE, archivedAt: null }, select: { id: true, code: true, name: true }, orderBy: [{ name: 'asc' }, { code: 'asc' }] }),
    ]);
    return { users, positions, jobTitles };
  }

  async createCycle(user: AuthenticatedUser, dto: CreatePerformanceCycleDto) {
    this.assertDatabaseMode();
    const version = await this.prisma.performanceTemplateVersion.findFirst({ where: { id: dto.templateVersionId, status: PerformanceVersionStatus.PUBLISHED }, include: { template: true } });
    if (!version) throw new BadRequestException('只能使用已发布的绩效模板版本');
    const definition = this.parser.assertValidDefinition(version.definition, true);
    const start = this.parseDate(dto.periodStart);
    const end = this.parseDate(dto.periodEnd);
    if (end < start) throw new BadRequestException('绩效周期结束日期不能早于开始日期');
    if (new Set(dto.employeeIds).size !== dto.employeeIds.length) throw new BadRequestException('员工不能重复选择');
    const accessible = await this.access.getAccessibleOrganizationIds(user);
    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: dto.employeeIds },
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        assignments: {
          some: {
            status: AssignmentStatus.ACTIVE,
            archivedAt: null,
            isPrimary: true,
            startDate: { lte: start },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
            ...(accessible === null ? {} : { organizationId: { in: accessible } }),
          },
        },
      },
      select: { id: true },
    });
    if (employees.length !== dto.employeeIds.length) throw new ForbiddenException('部分员工不在当前账号数据范围内或没有有效主要任职');
    const cycle = await this.prisma.$transaction(async (tx) => {
      const created = await tx.performanceCycle.create({ data: { name: dto.name.trim(), periodStart: start, periodEnd: end, templateId: version.templateId, templateVersionId: version.id, createdById: user.id } });
      for (const employeeId of dto.employeeIds) {
        const employeeAssignment = await tx.employeeAssignment.findFirst({ where: { employeeId, status: AssignmentStatus.ACTIVE, archivedAt: null, isPrimary: true, startDate: { lte: start }, OR: [{ endDate: null }, { endDate: { gte: start } }] }, select: { organizationId: true } });
        if (!employeeAssignment) throw new BadRequestException(`员工 ${employeeId} 在绩效周期开始日没有有效主要任职`);
        const instance = await tx.performanceInstance.create({ data: { cycleId: created.id, employeeId, organizationId: employeeAssignment.organizationId, sourceMarkdown: version.sourceMarkdown, definitionSnapshot: definition as unknown as Prisma.InputJsonValue } });
        for (const [moduleOrder, module] of definition.modules.entries()) {
          await tx.performanceModuleTask.create({ data: { instanceId: instance.id, employeeId, moduleId: module.id, moduleOrder, moduleName: module.name, moduleType: module.type, moduleWeight: module.weight === null ? null : DECIMAL(module.weight), moduleSnapshot: module as unknown as Prisma.InputJsonValue, executorType: module.executor.type, executorUserId: module.executor.userId, executorDirectoryType: module.executor.directoryType, executorDirectoryId: module.executor.directoryId, status: TaskStatus.PENDING } });
        }
      }
      await this.audit.create({ userId: user.id }, AuditAction.CREATE, created.id, { resource: 'performance-cycle', employeeCount: dto.employeeIds.length }, tx, 'performance_cycle');
      return tx.performanceCycle.findUniqueOrThrow({ where: { id: created.id }, include: { template: true, templateVersion: true, _count: { select: { instances: true } } } });
    });
    return this.presentCycle(cycle);
  }

  async startCycle(user: AuthenticatedUser, cycleId: string) {
    this.assertDatabaseMode();
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: cycleId }, include: { instances: true } });
    if (!cycle) throw new NotFoundException('绩效周期不存在');
    await this.assertCycleScope(user, cycle.instances);
    if (cycle.status !== ProcessStatus.DRAFT) throw new BadRequestException('只有草稿周期可以启动');
    const tasks = await this.prisma.performanceModuleTask.findMany({
      where: { instanceId: { in: cycle.instances.map((instance) => instance.id) } },
      orderBy: [{ instanceId: 'asc' }, { moduleOrder: 'asc' }],
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceCycle.update({ where: { id: cycleId }, data: { status: ProcessStatus.IN_PROGRESS, startedAt: new Date() } });
      for (const instance of cycle.instances) {
        const first = tasks.find((task) => task.instanceId === instance.id
          && task.status === TaskStatus.PENDING
          && (task.moduleSnapshot as { enabled?: boolean }).enabled !== false);
        if (!first) throw new BadRequestException(`员工 ${instance.employeeId} 没有可执行的绩效模块`);
        await tx.performanceInstance.update({ where: { id: instance.id }, data: { status: ProcessStatus.IN_PROGRESS, currentModuleOrder: first.moduleOrder } });
        await tx.performanceModuleTask.update({ where: { id: first.id, status: TaskStatus.PENDING }, data: { status: TaskStatus.IN_PROGRESS } });
      }
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, cycleId, { resource: 'performance-cycle', action: 'start' }, tx, 'performance_cycle');
    });

    // Advance each instance independently. The loop inside advanceInstance
    // also runs consecutive AUTO modules without unlocking later manual work.
    for (const instance of cycle.instances) await this.advanceInstance(instance.id);
    return this.getCycle(cycleId, user);
  }

  async listCycles(user: AuthenticatedUser, query: QueryPerformanceDto) {
    this.assertDatabaseMode();
    const scope = await this.access.getAccessibleOrganizationIds(user);
    const where: Prisma.PerformanceCycleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(scope === null ? {} : { instances: { some: { organizationId: { in: scope } } } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.performanceCycle.findMany({ where, include: { template: true, templateVersion: true, _count: { select: { instances: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.performanceCycle.count({ where }),
    ]);
    return { data: rows.map((row) => this.presentCycle(row)), meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async getCycle(id: string, user?: AuthenticatedUser) {
    this.assertDatabaseMode();
    const row = await this.prisma.performanceCycle.findUnique({ where: { id }, include: { template: true, templateVersion: true, instances: { include: { employee: { select: { name: true, employeeNo: true } }, tasks: { orderBy: { moduleOrder: 'asc' } } } } } });
    if (!row) throw new NotFoundException('绩效周期不存在');
    if (user) await this.assertCycleScope(user, row.instances);
    return { ...this.presentCycle(row), instances: row.instances.map((instance) => ({ id: instance.id, employeeId: instance.employeeId, employeeName: instance.employee.name, employeeNo: instance.employee.employeeNo, status: instance.status, currentModuleOrder: instance.currentModuleOrder, finalScore: this.number(instance.finalScore) })) };
  }

  async listTasks(user: AuthenticatedUser, query: QueryPerformanceDto, mine = false) {
    this.assertDatabaseMode();
    const scope = await this.access.getAccessibleOrganizationIds(user);
    const where: Prisma.PerformanceModuleTaskWhereInput = {
      ...(mine ? { executorUserId: user.id } : {}),
      ...(query.status && Object.values(TaskStatus).includes(query.status as unknown as TaskStatus) ? { status: query.status as unknown as TaskStatus } : {}),
      ...(scope === null ? {} : { employee: { assignments: { some: { status: AssignmentStatus.ACTIVE, archivedAt: null, organizationId: { in: scope }, isPrimary: true, endDate: null } } } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.performanceModuleTask.findMany({ where, include: { instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } }, tasks: { select: { id: true, moduleOrder: true, status: true } } } }, executorUser: { select: { displayName: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.performanceModuleTask.count({ where }),
    ]);
    return { data: rows.map((row) => this.presentTask(row)), meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async getTask(user: AuthenticatedUser, id: string) {
    this.assertDatabaseMode();
    const task = await this.prisma.performanceModuleTask.findUnique({ where: { id }, include: { instance: { include: { cycle: true, employee: { select: { name: true, employeeNo: true } }, tasks: { orderBy: { moduleOrder: 'asc' } } } }, executorUser: { select: { displayName: true, username: true } } } });
    if (!task) throw new NotFoundException('绩效任务不存在');
    const current = task.instance.currentModuleOrder === task.moduleOrder && task.status === TaskStatus.IN_PROGRESS;
    if (current && task.executorUserId !== user.id && !this.access.hasPermission(user, 'performance.read')) throw new ForbiddenException('没有查看此绩效任务的权限');
    const previousResults = task.instance.tasks.filter((item) => item.moduleOrder < task.moduleOrder && item.status === TaskStatus.COMPLETED).map((item) => ({ moduleName: item.moduleName, moduleScore: this.number(item.moduleScore), rawData: item.rawData, calculationDetails: item.calculationDetails, submission: item.submission }));
    return { ...this.presentTask(task), moduleSnapshot: task.moduleSnapshot, rawData: task.rawData, calculationDetails: task.calculationDetails, submission: task.submission, moduleScore: this.number(task.moduleScore), previousResults };
  }

  async submitTask(user: AuthenticatedUser, id: string, dto: PerformanceTaskSubmissionDto) {
    this.assertDatabaseMode();
    const task = await this.prisma.performanceModuleTask.findUnique({
      where: { id },
      include: { instance: { include: { cycle: true, tasks: { orderBy: { moduleOrder: 'asc' } } } } },
    });
    if (!task) throw new NotFoundException('绩效任务不存在');
    if (task.executorUserId !== user.id) throw new ForbiddenException('当前账号不是此任务执行人');
    if (task.status !== TaskStatus.IN_PROGRESS || task.instance.currentModuleOrder !== task.moduleOrder) throw new ConflictException('当前模块尚未开放或已经完成');
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
    const amount = row.amountBaseSnapshot === null ? null : Number(row.amountBaseSnapshot) * dto.finalScore / 100;
    const revisionNo = (await this.prisma.performanceResultRevision.count({ where: { instanceId: id } })) + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceResultRevision.create({ data: { instanceId: id, revisionNo, previousScore: row.finalScore!, nextScore: DECIMAL(dto.finalScore), scoreDelta: DECIMAL(dto.finalScore - Number(row.finalScore)), previousAmount: row.actualAmount, nextAmount: amount === null ? null : MONEY(amount), reason: dto.reason.trim(), beforeSnapshot: { finalScore: this.number(row.finalScore), actualAmount: this.number(row.actualAmount) }, afterSnapshot: { finalScore: dto.finalScore, actualAmount: amount }, modifiedById: user.id } });
      await tx.performanceInstance.update({ where: { id }, data: { finalScore: DECIMAL(dto.finalScore), actualAmount: amount === null ? null : MONEY(amount) } });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, id, { resource: 'performance-result', action: 'modify', revisionNo, previousScore: this.number(row.finalScore), nextScore: dto.finalScore, reason: dto.reason.trim() }, tx, 'performance_result');
    });
    return this.getResult(id);
  }

  async getAmountBase() {
    this.assertDatabaseMode();
    const row = await this.prisma.performanceAmountBaseVersion.findFirst({ orderBy: { versionNo: 'desc' }, include: { changedBy: { select: { displayName: true } } } });
    return row ? this.presentAmountBase(row) : null;
  }

  async listAmountBaseHistory() {
    this.assertDatabaseMode();
    const rows = await this.prisma.performanceAmountBaseVersion.findMany({ orderBy: [{ versionNo: 'desc' }], include: { changedBy: { select: { displayName: true } } } });
    return rows.map((row) => this.presentAmountBase(row));
  }

  async updateAmountBase(user: AuthenticatedUser, dto: UpdatePerformanceAmountBaseDto) {
    this.assertDatabaseMode();
    const latest = await this.prisma.performanceAmountBaseVersion.findFirst({ orderBy: { versionNo: 'desc' } });
    const row = await this.prisma.$transaction(async (tx) => {
      const version = await tx.performanceAmountBaseVersion.create({ data: { versionNo: (latest?.versionNo ?? 0) + 1, amount: MONEY(dto.amount), previousAmount: latest?.amount ?? null, effectiveAt: new Date(dto.effectiveAt), changedById: user.id, changeReason: dto.reason.trim() } });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, version.id, { resource: 'performance-amount-base', versionNo: version.versionNo, previousAmount: latest ? this.number(latest.amount) : null, amount: dto.amount, reason: dto.reason.trim() }, tx, 'performance_amount_base');
      return tx.performanceAmountBaseVersion.findUniqueOrThrow({ where: { id: version.id }, include: { changedBy: { select: { displayName: true } } } });
    });
    return this.presentAmountBase(row);
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
    const definition = this.parser.assertValidDefinition(dto.definition);
    const parsed = this.parser.parse(dto.sourceMarkdown, dto.sourceName ?? null);
    if (parsed.errors.length > 0) throw new BadRequestException(parsed.errors.map((error) => `${error.path}: ${error.message}`));
    // The edited definition is the confirmed, executable projection of the
    // source document. Legacy Markdown may not contain every machine-readable
    // field, so it is validated independently rather than compared by JSON
    // serialization. Declarative blocks are still parsed and validated above.
    return definition;
  }

  private async completeTask(task: PerformanceTaskRecord, user: AuthenticatedUser, moduleScore: number, submission: Record<string, unknown>) {
    if (!task.instance) throw new ConflictException('绩效任务关联实例不存在');
    const nextTask = task.instance.tasks.find((item) => item.moduleOrder > task.moduleOrder
      && item.status !== TaskStatus.CANCELLED
      && (item.moduleSnapshot as { enabled?: boolean }).enabled !== false);
    const isLast = !nextTask;
    const updatedTasks = task.instance.tasks.map((item) => item.id === task.id ? { ...item, status: TaskStatus.COMPLETED, moduleScore: DECIMAL(moduleScore) } : item);
    const resultUpdate = isLast ? await this.resultUpdate(updatedTasks) : {};
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceModuleTask.update({ where: { id: task.id }, data: { status: TaskStatus.COMPLETED, moduleScore: DECIMAL(moduleScore), submission: submission as Prisma.InputJsonValue, completedAt: new Date() } });
      if (nextTask) await tx.performanceModuleTask.update({ where: { id: nextTask.id }, data: { status: TaskStatus.IN_PROGRESS } });
      await tx.performanceInstance.update({ where: { id: task.instanceId, currentModuleOrder: task.moduleOrder }, data: { currentModuleOrder: nextTask?.moduleOrder ?? null, ...resultUpdate } });
      await this.audit.create({ userId: user.id }, AuditAction.UPDATE, task.id, { resource: 'performance-task', action: 'submit', moduleScore }, tx, 'performance_task');
    });
    if (nextTask?.moduleType === PerformanceModuleType.METRIC) await this.advanceInstance(task.instanceId);
    return this.getTask(user, task.id);
  }

  private async resultUpdate(tasks: Array<{ status: TaskStatus; moduleType: PerformanceModuleType; moduleWeight: Prisma.Decimal | null; moduleSnapshot: Prisma.JsonValue; moduleScore: Prisma.Decimal | null }>) {
    const completed = tasks.filter((task) => task.status === TaskStatus.COMPLETED && task.moduleScore !== null);
    const enabledTasks = tasks.filter((task) => (task.moduleSnapshot as { enabled?: boolean }).enabled !== false);
    if (enabledTasks.some((task) => task.status !== TaskStatus.COMPLETED)) throw new BadRequestException('所有启用的绩效模块完成后才能生成结果');
    if (completed.some((task) => task.moduleType !== PerformanceModuleType.ADJUSTMENT && task.moduleWeight === null)) throw new BadRequestException('固定权重模块缺少模块权重');
    const fixedTasks = completed.filter((task) => task.moduleType !== PerformanceModuleType.ADJUSTMENT);
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
    const amountBase = await this.prisma.performanceAmountBaseVersion.findFirst({ where: { effectiveAt: { lte: new Date() } }, orderBy: { effectiveAt: 'desc' } });
    if (!amountBase) throw new BadRequestException('绩效结果生成前必须先配置有效的金额基数');
    const amount = finalScore * Number(amountBase.amount) / 100;
    return { fixedWeightedScore: DECIMAL(fixedWeightedScore), adjustmentScore: DECIMAL(adjustmentScore), rawFinalScore: DECIMAL(rawFinalScore), finalScore: DECIMAL(finalScore), amountBaseVersionId: amountBase.id, amountBaseSnapshot: amountBase.amount, calculationFormula: 'Σ(模块得分 × 模块权重 ÷ 100) + 调整项; 最低为 0', actualAmount: amount === null ? null : MONEY(amount), status: ProcessStatus.COMPLETED };
  }

  private async advanceInstance(instanceId: string) {
    const instance = await this.prisma.performanceInstance.findUnique({ where: { id: instanceId }, include: { cycle: true, tasks: { orderBy: { moduleOrder: 'asc' } } } });
    if (!instance || instance.currentModuleOrder === null) return;
    let task = instance.tasks.find((item) => item.moduleOrder === instance.currentModuleOrder);
    while (task && task.status === TaskStatus.IN_PROGRESS && task.moduleType === PerformanceModuleType.METRIC) {
      await this.resolveExecutor(task, instance.cycle.periodStart);
      const metricScore = await this.executeMetricTask(task, instance.cycle.periodStart, instance.cycle.periodEnd);
      task.status = TaskStatus.COMPLETED;
      task.moduleScore = DECIMAL(metricScore);
      const nextTask = instance.tasks.find((item) => item.moduleOrder > task!.moduleOrder
        && item.status !== TaskStatus.CANCELLED
        && (item.moduleSnapshot as { enabled?: boolean }).enabled !== false);
      if (!nextTask) {
        const resultUpdate = await this.resultUpdate(instance.tasks);
        await this.prisma.performanceInstance.update({ where: { id: instance.id }, data: { currentModuleOrder: null, ...resultUpdate } });
        return;
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.performanceModuleTask.update({ where: { id: nextTask.id, status: TaskStatus.PENDING }, data: { status: TaskStatus.IN_PROGRESS } });
        await tx.performanceInstance.update({ where: { id: instance.id, currentModuleOrder: task!.moduleOrder }, data: { currentModuleOrder: nextTask.moduleOrder } });
      });
      nextTask.status = TaskStatus.IN_PROGRESS;
      task = nextTask;
    }
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
      const context = { completionRate, targetValue: metric.targetValue, actualValue: metric.actualValue, ...(metric.fields ?? {}) };
      const score = indicator.rule ? this.rules.evaluate(indicator.rule, context) : Math.min(100, Math.max(0, completionRate * 100));
      if (!Number.isFinite(score) || score < 0 || score > 100) throw new BadRequestException(`指标“${indicator.name}”计算得分必须在 0-100 范围内`);
      return { indicatorId: indicator.id, targetValue: metric.targetValue, actualValue: metric.actualValue, completionRate, weight: metric.weight, score };
    });
    const totalWeight = details.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.0001) throw new BadRequestException(`业务指标权重合计必须为 100%，当前为 ${totalWeight}%`);
    const moduleScore = details.reduce((sum, item) => sum + item.score * item.weight / 100, 0);
    await this.prisma.performanceModuleTask.update({ where: { id: task.id }, data: { status: TaskStatus.COMPLETED, rawData: metrics as unknown as Prisma.InputJsonValue, calculationDetails: details as unknown as Prisma.InputJsonValue, moduleScore: DECIMAL(moduleScore), completedAt: new Date() } });
    return moduleScore;
  }

  private async resolveExecutor(task: PerformanceTaskRecord, effectiveAt: Date) {
    const module = task.moduleSnapshot as unknown as PerformanceModuleDefinition;
    if (task.executorType === PerformanceExecutorType.AUTO) return;
    let userId = task.executorUserId;
    if (task.executorType === PerformanceExecutorType.DIRECTORY) {
      const directoryFilter = task.executorDirectoryType === PerformanceDirectoryType.POSITION ? { positionId: task.executorDirectoryId } : { jobTitleId: task.executorDirectoryId };
      const matches = await this.prisma.employee.findMany({ where: { recordStatus: RecordStatus.ACTIVE, archivedAt: null, assignments: { some: { ...directoryFilter, status: AssignmentStatus.ACTIVE, isPrimary: true, startDate: { lte: effectiveAt }, OR: [{ endDate: null }, { endDate: { gte: effectiveAt } }] } }, user: { status: RecordStatus.ACTIVE, archivedAt: null } }, select: { id: true, user: { select: { id: true, username: true, displayName: true } } } });
      if (matches.length !== 1 || !matches[0]?.user) throw new BadRequestException(`模块“${module.name}”岗位执行人必须唯一匹配一个有效账号`);
      userId = matches[0].user.id;
    }
    if (!userId) throw new BadRequestException(`模块“${module.name}”未指定执行人`);
    const executor = await this.prisma.user.findFirst({ where: { id: userId, status: RecordStatus.ACTIVE, archivedAt: null }, select: { id: true, username: true, displayName: true } });
    if (!executor) throw new BadRequestException(`模块“${module.name}”执行人账号不存在或已停用`);
    await this.prisma.performanceModuleTask.update({ where: { id: task.id }, data: { executorUserId: executor.id, executorNameSnapshot: executor.displayName, executorAccountSnapshot: executor.username, executorResolvedAt: new Date() } });
  }

  private presentTemplate(row: any) { const version = row.versions[0]; return { id: row.id, name: row.name, description: row.description, status: row.status, latestVersion: version ? this.presentVersionSummary(version) : null, moduleCount: this.moduleCount(version?.definition), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
  private presentTemplateDetail(row: any) { return { ...this.presentTemplate({ ...row, versions: row.versions }), versions: row.versions.map((version: any) => ({ ...this.presentVersionSummary(version), sourceMarkdown: version.sourceMarkdown, definition: version.definition })) }; }
  private presentVersion(version: any) { return { ...this.presentVersionSummary(version), sourceMarkdown: version.sourceMarkdown, definition: version.definition }; }
  private presentVersionSummary(version: any) { return { id: version.id, versionNo: version.versionNo, status: version.status, sourceName: version.sourceName, createdAt: version.createdAt.toISOString(), publishedAt: version.publishedAt?.toISOString() ?? null }; }
  private presentCycle(row: any) { return { id: row.id, name: row.name, periodStart: this.date(row.periodStart), periodEnd: this.date(row.periodEnd), templateName: row.template?.name ?? '', templateVersionNo: row.templateVersion?.versionNo ?? 0, status: row.status, instanceCount: row._count?.instances ?? row.instances?.length ?? 0, completedInstanceCount: row.instances?.filter((instance: any) => instance.status === ProcessStatus.COMPLETED).length ?? 0, createdAt: row.createdAt.toISOString() }; }
  private presentTask(row: any) { const current = row.instance?.currentModuleOrder === row.moduleOrder && row.status === TaskStatus.IN_PROGRESS; return { id: row.id, cycleId: row.instance?.cycleId, cycleName: row.instance?.cycle?.name ?? '', instanceId: row.instanceId, employeeId: row.employeeId, employeeName: row.instance?.employee?.name ?? '', employeeNo: row.instance?.employee?.employeeNo ?? '', moduleId: row.moduleId, moduleName: row.moduleName, moduleType: row.moduleType, moduleOrder: row.moduleOrder, moduleWeight: this.number(row.moduleWeight), status: row.status, executorName: row.executorNameSnapshot ?? row.executorUser?.displayName ?? null, isCurrent: current, canSubmit: current, completedAt: row.completedAt?.toISOString() ?? null }; }
  private presentResult(row: any) { return { id: row.id, cycleId: row.cycleId, cycleName: row.cycle?.name ?? '', employeeId: row.employeeId, employeeName: row.employee?.name ?? '', employeeNo: row.employee?.employeeNo ?? '', finalScore: this.number(row.finalScore), amountBaseSnapshot: this.number(row.amountBaseSnapshot), actualAmount: this.number(row.actualAmount), status: row.status, revisionCount: row.revisions?.length ?? 0 }; }
  private presentAmountBase(row: any) { return { id: row.id, versionNo: row.versionNo, amount: this.number(row.amount)!, previousAmount: this.number(row.previousAmount), effectiveAt: row.effectiveAt.toISOString(), changedByName: row.changedBy?.displayName ?? null, changeReason: row.changeReason, createdAt: row.createdAt.toISOString() }; }
  private async assertCycleScope(user: AuthenticatedUser, instances: Array<{ organizationId: string | null }>) {
    if (this.access.hasAllEmployeeData(user)) return;
    const scope = await this.access.getAccessibleOrganizationIds(user);
    if (instances.some((instance) => !instance.organizationId || !scope?.includes(instance.organizationId))) throw new ForbiddenException('绩效周期不在当前账号数据范围内');
  }

  private moduleCount(definition: unknown) { return this.isRecord(definition) && Array.isArray(definition.modules) ? definition.modules.length : 0; }
  private number(value: Prisma.Decimal | null | undefined) { return value === null || value === undefined ? null : Number(value); }
  private date(value: Date) { return value.toISOString().slice(0, 10); }
  private parseDate(value: string) { const date = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(date.getTime())) throw new BadRequestException('日期格式无效'); return date; }
  private assertDatabaseMode() { if (this.demo.enabled) throw new ConflictException('绩效模块仅支持数据库模式'); }
  private isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
}
