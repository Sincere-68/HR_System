import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AuditAction, PerformanceExceptionHandlerType, PerformanceModuleType, PerformanceExecutorType, ProcessStatus, RecordStatus, TaskStatus } from '@prisma/client';
import type { PerformanceParseError } from '@hr-demo/shared';
import { PerformanceRuleEngine } from './performance-rule-engine';
import { PerformanceTemplateParser } from './performance-template.parser';
import { PerformanceService } from './performance.service';

const definition = {
  schemaVersion: 1,
  name: '虚构绩效模板',
  modules: [
    { id: 'metric', name: '指标模块', type: 'METRIC', enabled: true, participatesInTotal: true, weight: 50, description: '', executor: { type: 'AUTO' }, indicators: [{ id: 'completion', name: '完成率', description: '', standards: [], weight: 100, rule: { op: 'field', field: 'completionRate' } }] },
    { id: 'evaluation', name: '人工模块', type: 'EVALUATION', enabled: true, participatesInTotal: true, weight: 50, description: '', executor: { type: 'USER', executionMode: 'SINGLE', userIds: ['user-1'] }, indicators: [] },
  ],
} as const;
const markdown = `# 测试\n\n\`\`\`performance-template\n${JSON.stringify(definition)}\n\`\`\``;

function service(overrides: Record<string, unknown> = {}) {
  const prisma = { performanceTemplate: {}, performanceTemplateVersion: {}, performanceCycle: {}, performanceInstance: {}, performanceModuleTask: {}, performanceResultRevision: {}, employeePerformanceAmountBase: {}, employee: {}, user: {}, $transaction: jest.fn(), ...overrides };
  const access = { getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null), hasPermission: jest.fn().mockReturnValue(true) };
  const demo = { enabled: false };
  const audit = { create: jest.fn().mockResolvedValue(undefined) };
  return new PerformanceService(prisma as never, access as never, audit as never, demo as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
}

describe('Performance activity creation', () => {
  const activityDto = {
    name: '虚构季度绩效活动',
    organizationId: 'org-root',
    isPublic: true,
    linkedLevel: true,
    templateVersionId: 'version-1',
    year: 2026,
    periodType: 'QUARTERLY',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    exceptionHandlerType: PerformanceExceptionHandlerType.SPECIFIED_USER,
    exceptionHandlerEmployeeId: 'handler-1',
    lockRelation: true,
  };

  it('derives all participating employees from the organization subtree', async () => {
    const definition = { ...({ schemaVersion: 1, name: '模板', modules: [{ id: 'evaluation', name: '人工模块', type: 'EVALUATION', enabled: true, participatesInTotal: true, weight: 100, description: '', executor: { type: 'USER', executionMode: 'SINGLE', userIds: ['executor-1'] }, indicators: [] }] }) };
    const createdCycle = { id: 'cycle-1', name: activityDto.name, organizationId: 'org-root', isPublic: true, linkedLevel: true, year: 2026, periodType: 'QUARTERLY', exceptionHandlerType: 'SPECIFIED_USER', exceptionHandlerEmployeeId: 'handler-1', lockRelation: true, periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-03-31'), status: 'DRAFT', template: { name: '模板' }, templateVersion: { versionNo: 1 }, organization: { id: 'org-root', name: '根组织' }, createdBy: { displayName: '创建人' }, exceptionHandlerEmployee: { id: 'handler-1', name: '异常处理人', employeeNo: 'E001' }, _count: { instances: 2 }, createdAt: new Date() };
    const tx = {
      performanceCycle: { create: jest.fn().mockResolvedValue({ id: 'cycle-1' }), findUniqueOrThrow: jest.fn().mockResolvedValue(createdCycle) },
      performanceInstance: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      performanceModuleTask: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      performanceTemplateVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'version-1', templateId: 'template-1', sourceMarkdown: '', definition, template: {} }) },
      employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-1', assignments: [{ organizationId: 'org-root' }] }, { id: 'employee-2', assignments: [{ organizationId: 'org-child' }] }]), findFirst: jest.fn().mockResolvedValue({ id: 'handler-1' }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const access = { assertOrganizationAccess: jest.fn().mockResolvedValue(undefined), getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-root', 'org-child']), getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-root', 'org-child']) };
    const instance = new PerformanceService(prisma as never, access as never, { create: jest.fn().mockResolvedValue(undefined) } as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const result = await instance.createCycle({ id: 'creator' } as never, activityDto as never);
    expect(access.assertOrganizationAccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'creator' }), 'org-root');
    expect(access.getOrganizationSubtreeIds).toHaveBeenCalledWith('org-root', ['org-root', 'org-child']);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ assignments: { some: expect.objectContaining({ organizationId: { in: ['org-root', 'org-child'] } }) } }) }));
    expect(tx.performanceInstance.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ employeeId: 'employee-1', organizationId: 'org-root' }),
        expect.objectContaining({ employeeId: 'employee-2', organizationId: 'org-child' }),
      ]),
    }));
    expect(tx.performanceModuleTask.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ employeeId: 'employee-1', moduleId: 'evaluation', moduleOrder: 0 }),
        expect.objectContaining({ employeeId: 'employee-2', moduleId: 'evaluation', moduleOrder: 0 }),
      ]),
    }));
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), { maxWait: 10_000, timeout: 30_000 });
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'handler-1' }) }));
    expect(result).toMatchObject({ organizationId: 'org-root', organizationName: '根组织', isPublic: true, createdByName: '创建人', exceptionHandlerEmployeeNo: 'E001', instanceCount: 2 });
  });

  it('allows an activity draft without a template or participants', async () => {
    const createdCycle = { id: 'cycle-empty', name: activityDto.name, organizationId: 'org-root', isPublic: true, linkedLevel: true, year: 2026, periodType: 'QUARTERLY', exceptionHandlerType: 'SPECIFIED_USER', exceptionHandlerEmployeeId: 'handler-1', lockRelation: true, periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-03-31'), status: 'DRAFT', template: null, organization: { id: 'org-root', name: '根组织' }, createdBy: { displayName: '创建人' }, exceptionHandlerEmployee: { id: 'handler-1', name: '异常处理人', employeeNo: 'E001' }, _count: { instances: 0 }, createdAt: new Date() };
    const tx = { performanceCycle: { create: jest.fn().mockResolvedValue({ id: 'cycle-empty' }), findUniqueOrThrow: jest.fn().mockResolvedValue(createdCycle) }, performanceInstance: { createMany: jest.fn() }, performanceModuleTask: { createMany: jest.fn() } };
    const prisma = { employee: { findFirst: jest.fn().mockResolvedValue({ id: 'handler-1' }), findMany: jest.fn().mockResolvedValue([]) }, $transaction: jest.fn((callback) => callback(tx)) };
    const access = { assertOrganizationAccess: jest.fn().mockResolvedValue(undefined), getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null), getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-root']) };
    const instance = new PerformanceService(prisma as never, access as never, { create: jest.fn().mockResolvedValue(undefined) } as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    const result = await instance.createCycle({ id: 'creator' } as never, { ...activityDto, templateVersionId: undefined } as never);

    expect(tx.performanceCycle.create).toHaveBeenCalled();
    expect(tx.performanceInstance.createMany).toHaveBeenCalledWith({ data: [] });
    expect(result).toMatchObject({ id: 'cycle-empty', instanceCount: 0 });
  });

  it('binds one participant to one selected published template', async () => {
    const tx = {
      performanceInstance: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      performanceModuleTask: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const cycle = { id: 'cycle-1', organizationId: 'org-root', status: 'DRAFT', periodStart: new Date('2026-01-01'), instances: [] };
    const prisma = {
      performanceCycle: { findUnique: jest.fn().mockResolvedValue(cycle) },
      performanceTemplateVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'version-2', sourceMarkdown: '', definition: { schemaVersion: 1, name: '单人模板', modules: [{ id: 'evaluation', name: '人工模块', type: 'EVALUATION', enabled: true, participatesInTotal: true, weight: 100, description: '', executor: { type: 'USER', executionMode: 'SINGLE', userIds: ['executor-1'] }, indicators: [] }] } }) },
      employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-1', assignments: [{ organizationId: 'org-root' }] }]) },
      performanceModuleTask: { findMany: jest.fn() },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const access = { hasAllEmployeeData: jest.fn().mockReturnValue(true), getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const instance = new PerformanceService(prisma as never, access as never, audit as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    (instance as any).getCycle = jest.fn().mockResolvedValue({ id: 'cycle-1' });

    await instance.addCycleParticipants({ id: 'manager' } as never, 'cycle-1', { employeeId: 'employee-1', templateVersionId: 'version-2' });

    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ['employee-1'] } }) }));
    expect(tx.performanceInstance.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ employeeId: 'employee-1' })] }));
  });

  it('checks current amount bases only for employees already in the activity', async () => {
    const cycle = { id: 'cycle-1', organizationId: 'org-root', status: 'DRAFT', instances: [{ id: 'instance-1', employeeId: 'employee-1', organizationId: 'org-root' }] };
    const prisma = {
      performanceCycle: { findUnique: jest.fn().mockResolvedValue(cycle) },
      performanceModuleTask: { findMany: jest.fn().mockResolvedValue([{ id: 'task-1', instanceId: 'instance-1', status: TaskStatus.PENDING, moduleType: PerformanceModuleType.EVALUATION, moduleSnapshot: {} }]) },
      employeePerformanceAmountBase: { findMany: jest.fn().mockResolvedValue([{ employeeId: 'employee-1' }]) },
      $transaction: jest.fn(),
    };
    const access = { hasAllEmployeeData: jest.fn().mockReturnValue(true) };
    const instance = new PerformanceService(prisma as never, access as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    await expect(instance.startCycle({ id: 'manager' } as never, 'cycle-1')).rejects.not.toThrow('缺少金额基数');
    expect(prisma.employeePerformanceAmountBase.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: { in: ['employee-1'] }, replacedAt: null } }));
  });

  it('blocks starting an activity if any participant lacks generated template tasks', async () => {
    const cycle = { id: 'cycle-1', organizationId: 'org-root', status: 'DRAFT', instances: [{ id: 'instance-1', organizationId: 'org-root' }, { id: 'instance-2', organizationId: 'org-root' }] };
    const prisma = {
      performanceCycle: { findUnique: jest.fn().mockResolvedValue(cycle) },
      performanceModuleTask: { findMany: jest.fn().mockResolvedValue([{ id: 'task-1', instanceId: 'instance-1' }]) },
    };
    const access = { hasAllEmployeeData: jest.fn().mockReturnValue(true) };
    const instance = new PerformanceService(prisma as never, access as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    await expect(instance.startCycle({ id: 'manager' } as never, 'cycle-1')).rejects.toThrow('部分被考核人尚未配置绩效模板');
  });

  it('archives an activity without physically deleting instances or tasks', async () => {
    const archived = { id: 'cycle-1', name: '测试活动', organizationId: 'org-root', isPublic: false, linkedLevel: true, year: 2026, periodType: 'QUARTERLY', exceptionHandlerType: 'DIRECT_MANAGER', exceptionHandlerEmployeeId: null, lockRelation: false, periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-03-31'), status: 'CANCELLED', archivedAt: new Date(), template: { name: '模板' }, templateVersion: { versionNo: 1 }, organization: { id: 'org-root', name: '根组织' }, createdBy: { displayName: '创建人' }, exceptionHandlerEmployee: null, _count: { instances: 1 }, createdAt: new Date() };
    const tx = {
      performanceCycle: { update: jest.fn().mockResolvedValue(archived) },
      performanceInstance: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      performanceModuleTask: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      performanceWorkflowTask: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      performanceCycle: { findUnique: jest.fn().mockResolvedValue({ id: 'cycle-1', organizationId: 'org-root', status: 'IN_PROGRESS', archivedAt: null, instances: [{ organizationId: 'org-root' }] }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const access = { hasAllEmployeeData: jest.fn().mockReturnValue(true) };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const instance = new PerformanceService(prisma as never, access as never, audit as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    const result = await instance.archiveCycle({ id: 'manager' } as never, 'cycle-1', { reason: '测试归档' });

    expect(tx.performanceCycle.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ archivedById: 'manager', archiveReason: '测试归档', status: 'CANCELLED' }) }));
    expect(tx.performanceInstance.updateMany).toHaveBeenCalled();
    expect(tx.performanceModuleTask.updateMany).toHaveBeenCalled();
    expect(tx.performanceWorkflowTask.updateMany).toHaveBeenCalled();
    expect(result.id).toBe('cycle-1');
  });

  it('requires a published template version when creating an activity', async () => {
    const prisma = {
      performanceTemplateVersion: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    await expect(instance.createCycle({ id: 'creator' } as never, { ...activityDto, templateVersionId: 'missing-version' } as never)).rejects.toThrow('只能使用已发布的绩效模板版本');
  });

  it('rejects a client-supplied participant list that differs from the organization result', async () => {
    const prisma = {
      performanceTemplateVersion: { findFirst: jest.fn().mockResolvedValue({
        id: 'version-1',
        templateId: 'template-1',
        template: {},
        definition: {
          schemaVersion: 1,
          name: '模板',
          modules: [{ id: 'evaluation', name: '人工模块', type: 'EVALUATION', enabled: true, participatesInTotal: true, weight: 100, description: '', executor: { type: 'USER', executionMode: 'SINGLE', userIds: ['executor-1'] }, indicators: [] }],
        },
      }) },
      employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-1', assignments: [{ organizationId: 'org-root' }] }]) },
    };
    const access = { assertOrganizationAccess: jest.fn().mockResolvedValue(undefined), getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null), getOrganizationSubtreeIds: jest.fn().mockResolvedValue(['org-root']) };
    const instance = new PerformanceService(prisma as never, access as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    await expect(instance.createCycle({ id: 'creator' } as never, { ...activityDto, employeeIds: ['other-employee'] } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Performance activity participant amount-base marker', () => {
  it('marks configuration from the employee current base instead of the post-calculation snapshot', async () => {
    const row = {
      id: 'cycle-1', name: '虚构活动', organizationId: 'org-1', isPublic: false, linkedLevel: false, year: 2026, periodType: 'QUARTERLY', exceptionHandlerType: 'DIRECT_MANAGER', exceptionHandlerEmployeeId: null, lockRelation: false, periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-03-31'), status: ProcessStatus.DRAFT, createdAt: new Date(),
      organization: { id: 'org-1', name: '虚构组织' }, template: { name: '虚构模板' }, templateVersion: { versionNo: 1 }, createdBy: { displayName: '管理员' }, exceptionHandlerEmployee: null, _count: { instances: 1 },
      instances: [{ id: 'instance-1', employeeId: 'employee-1', organization: { name: '虚构组织' }, employeeAmountBaseId: null, employeeAmountBaseSnapshot: null, currentModuleOrder: null, assessmentStatus: ProcessStatus.DRAFT, assessmentCompletedAt: null, workflowCompletedAt: null, status: ProcessStatus.DRAFT, finalScore: null, employee: { name: '虚构员工', employeeNo: 'FAKE-001', employmentPeriods: [], performanceAmountBases: [{ id: 'base-1' }] }, tasks: [], workflowTasks: [] }],
    };
    const prisma = { performanceCycle: { findUnique: jest.fn().mockResolvedValue(row) } };
    const service = new PerformanceService(prisma as never, { hasAllEmployeeData: jest.fn().mockReturnValue(true) } as never, { create: jest.fn() } as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    const result = await service.getCycle('cycle-1', { id: 'viewer' } as never);

    expect(result.instances[0]).toMatchObject({ employeeAmountBaseConfigured: true, employeeAmountBaseAmount: null });
  });
});

describe('Performance participant assessment details', () => {
  it('presents saved metric scores and frozen amount snapshots without recalculating', async () => {
    const instanceRow = {
      id: 'instance-1', cycleId: 'cycle-1', organizationId: 'org-1', finalScore: 82.5, fixedWeightedScore: 80, adjustmentScore: 2.5, employeeAmountBaseId: 'base-1', employeeAmountBaseVersionNo: 3, employeeAmountBaseSnapshot: 2000, calculationFormula: 'Σ(模块得分 × 模块权重 ÷ 100) + 调整项; 最低为 0', actualAmount: 1650,
      cycle: { id: 'cycle-1', name: '虚构活动', organizationId: 'org-1', status: ProcessStatus.COMPLETED, archivedAt: null, template: { name: '虚构模板' }, templateVersion: { versionNo: 1 } },
      employee: { id: 'employee-1', name: '虚构员工', employeeNo: 'FAKE-001' },
      tasks: [{ id: 'metric-task', moduleName: '业务指标', moduleType: PerformanceModuleType.METRIC, moduleWeight: 100, moduleScore: 80, status: TaskStatus.COMPLETED, moduleSnapshot: { indicators: [{ id: 'metric-1', name: '交付质量', description: '完成情况', standards: ['按时交付'], weight: 100 }] }, calculationDetails: [{ indicatorId: 'metric-1', score: 80 }], assignees: [] }],
    };
    const prisma = { performanceInstance: { findFirst: jest.fn().mockResolvedValue(instanceRow) } };
    const access = { hasAllEmployeeData: jest.fn().mockReturnValue(true) };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const instance = new PerformanceService(prisma as never, access as never, audit as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    const result = await instance.getParticipantAssessmentDetail({ id: 'viewer' } as never, 'cycle-1', 'instance-1');

    expect(result).toMatchObject({ finalScore: 82.5, finalCoefficient: 0.825, employeeAmountBaseSnapshot: 2000, actualAmount: 1650, calculationStatus: 'CALCULATED' });
    expect(result.modules[0]?.indicators[0]).toMatchObject({ name: '交付质量', rawScore: 80, weightedScore: 80, standards: ['按时交付'] });
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'viewer' }), AuditAction.DETAIL_VIEW, 'instance-1', expect.objectContaining({ resource: 'performance-participant-assessment-detail' }), prisma, 'performance_participant_assessment_detail');
  });

  it('does not fabricate per-indicator scores for an uncompleted manual module', async () => {
    const instanceRow = {
      id: 'instance-1', cycleId: 'cycle-1', organizationId: 'org-1', finalScore: null, fixedWeightedScore: null, adjustmentScore: 0, employeeAmountBaseId: null, employeeAmountBaseVersionNo: null, employeeAmountBaseSnapshot: null, calculationFormula: null, actualAmount: null,
      cycle: { id: 'cycle-1', name: '虚构活动', organizationId: 'org-1', status: ProcessStatus.IN_PROGRESS, archivedAt: null, template: { name: '虚构模板' }, templateVersion: { versionNo: 1 } },
      employee: { id: 'employee-1', name: '虚构员工', employeeNo: 'FAKE-001' },
      tasks: [{ id: 'evaluation-task', moduleName: '人工评价', moduleType: PerformanceModuleType.EVALUATION, moduleWeight: 100, moduleScore: null, status: TaskStatus.IN_PROGRESS, moduleSnapshot: { indicators: [{ id: 'indicator-1', name: '沟通能力', description: '', standards: ['及时响应'], weight: 100 }] }, calculationDetails: null, assignees: [{ displayNameSnapshot: '虚构评分人' }] }],
    };
    const instance = new PerformanceService({ performanceInstance: { findFirst: jest.fn().mockResolvedValue(instanceRow) } } as never, { hasAllEmployeeData: jest.fn().mockReturnValue(true) } as never, { create: jest.fn() } as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    const result = await instance.getParticipantAssessmentDetail({ id: 'viewer' } as never, 'cycle-1', 'instance-1');

    expect(result.modules[0]?.indicators[0]).toMatchObject({ rawScore: null, weightedScore: null, scoreSource: 'UNAVAILABLE' });
    expect(result).toMatchObject({ calculationStatus: 'NOT_READY' });
  });
});

describe('Performance participant workflow details', () => {
  it('uses the activity and instance together, scopes access, and records the workflow-detail view', async () => {
    const now = new Date('2026-09-17T08:00:00.000Z');
    const instanceRow = {
      id: 'instance-1',
      cycleId: 'cycle-1',
      organizationId: 'org-1',
      cycle: { id: 'cycle-1', name: '虚构活动', organizationId: 'org-1', template: { name: '虚构模板' }, templateVersion: { versionNo: 2 } },
      employee: { id: 'employee-1', name: '虚构员工', employeeNo: 'FAKE-001' },
      tasks: [{ id: 'assessment-task', moduleName: '人工评估', moduleType: PerformanceModuleType.EVALUATION, moduleOrder: 0, moduleSnapshot: { executor: { type: 'USER' } }, status: TaskStatus.IN_PROGRESS, completedAt: null, assignees: [{ id: 'assessment-assignee', employeeId: 'executor-1', displayNameSnapshot: '虚构执行人', status: TaskStatus.IN_PROGRESS, completedAt: null, notificationDeliveries: [{ id: 'delivery-1', channel: 'FEISHU_CARD', status: 'DELIVERED', deliveredAt: now, failureReason: null, createdAt: now }] }] }],
      workflowTasks: [],
    };
    const prisma = { performanceInstance: { findFirst: jest.fn().mockResolvedValue(instanceRow) } };
    const access = { hasAllEmployeeData: jest.fn().mockReturnValue(false), getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-1']) };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const instance = new PerformanceService(prisma as never, access as never, audit as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    const result = await instance.getParticipantWorkflow({ id: 'viewer' } as never, 'cycle-1', 'instance-1');

    expect(prisma.performanceInstance.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'instance-1', cycleId: 'cycle-1' }) }));
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'viewer' }), 'DETAIL_VIEW', 'instance-1', expect.objectContaining({ resource: 'performance-participant-workflow' }), prisma, 'performance_participant_workflow');
    expect(result.steps[0]).toMatchObject({ name: '人工评估', source: 'ASSESSMENT', assignees: [expect.objectContaining({ deliveredAt: now.toISOString(), submittedAt: null, deliveryStatus: 'DELIVERED' })] });
  });

  it('records skipped delivery when Feishu is disabled without claiming delivery', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'delivery-1' });
    const update = jest.fn().mockResolvedValue({});
    const prisma = { performanceAssessmentNotificationDelivery: { create, update } };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    await (instance as any).deliverAssessmentCard({ id: 'task-1' }, { id: 'assignee-1', employee: { workEmail: 'fictional@example.invalid', mobile: null } });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED', deliveredAt: null }) }));
  });

  it('records confirmed Feishu card delivery separately from submission time', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'delivery-1' });
    const updateDelivery = jest.fn().mockResolvedValue({});
    const updateAssignee = jest.fn().mockResolvedValue({ count: 1 });
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const feishu = { enabled: true, resolveOpenIdByContact: jest.fn().mockResolvedValue('ou_fake'), sendCardToOpenId: jest.fn().mockResolvedValue(true) };
    const prisma = {
      performanceAssessmentNotificationDelivery: { create, update: updateDelivery },
      performanceModuleTaskAssignee: { updateMany: updateAssignee },
    };
    const instance = new PerformanceService(prisma as never, {} as never, audit as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, feishu as never);
    jest.spyOn(instance as any, 'issueAssessmentCardToken').mockResolvedValue('secret-token');

    await (instance as any).deliverAssessmentCard({ id: 'task-1', moduleType: PerformanceModuleType.EVALUATION, moduleName: '人工评估', moduleSnapshot: {}, instance: { cycle: { name: '虚构活动' }, employee: { name: '虚构员工' } } }, { id: 'assignee-1', employee: { workEmail: 'fictional@example.invalid', mobile: null } });

    expect(updateAssignee).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ cardIssuedAt: expect.any(Date) }) }));
    expect(updateDelivery).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DELIVERED', deliveredAt: expect.any(Date) }) }));
  });
});

describe('Performance template archive and draft activities', () => {
  it('publishes a newly saved template so it is immediately usable by an activity', async () => {
    const created = { id: 'template-1' };
    const stored = { id: 'template-1', name: '模板', description: null, status: RecordStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(), versions: [{ id: 'version-1', versionNo: 1, status: 'PUBLISHED', sourceType: 'MANUAL', sourceName: null, createdAt: new Date(), publishedAt: new Date(), definition }] };
    const tx = {
      performanceTemplate: { create: jest.fn().mockResolvedValue(created), findUniqueOrThrow: jest.fn().mockResolvedValue(stored) },
      performanceTemplateVersion: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { user: { findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }]) }, employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-1' }]) }, $transaction: jest.fn((callback) => callback(tx)) };
    const instance = new PerformanceService(prisma as never, { getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null) } as never, { create: jest.fn().mockResolvedValue(undefined) } as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    await instance.createTemplate({ id: 'user-1' } as never, { name: '模板', sourceType: 'MANUAL', definition } as never);

    expect(tx.performanceTemplateVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED', publishedAt: expect.any(Date) }) }));
  });

  it('archives a template instead of physically deleting it', async () => {
    const archived = { id: 'template-1', name: '模板', description: null, status: RecordStatus.ARCHIVED, archivedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), versions: [] };
    const tx = { performanceTemplate: { update: jest.fn().mockResolvedValue(archived) } };
    const prisma = { performanceTemplate: { findFirst: jest.fn().mockResolvedValue({ id: 'template-1' }) }, $transaction: jest.fn((callback) => callback(tx)) };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const instance = new PerformanceService(prisma as never, {} as never, audit as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const result = await instance.archiveTemplate({ id: 'user-1' } as never, 'template-1', { reason: '测试归档' });
    expect(tx.performanceTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: RecordStatus.ARCHIVED, archivedById: 'user-1', archiveReason: '测试归档' }) }));
    expect(result.id).toBe('template-1');
  });

  it('retains display snapshots only for the selected employee ids', () => {
    const parser = new PerformanceTemplateParser();
    const normalized = parser.assertValidDefinition({
      schemaVersion: 1,
      name: '快照模板',
      modules: [
        { id: 'evaluation', name: '人工模块', type: 'EVALUATION', enabled: true, participatesInTotal: true, weight: 100, description: '', executor: { type: 'USER', executionMode: 'SINGLE', employeeIds: ['employee-1'], employeeSnapshots: [{ employeeId: 'employee-1', name: '执行人', employeeNo: 'E001', organizationId: 'org-1', organizationName: '人力资源部' }, { employeeId: 'stale', name: '过期人员', employeeNo: 'E999', organizationId: null, organizationName: null }] }, indicators: [] },
      ],
    }, true);

    expect(normalized.modules[0]?.executor).toMatchObject({
      employeeIds: ['employee-1'],
      employeeSnapshots: [{ employeeId: 'employee-1', name: '执行人', employeeNo: 'E001', organizationName: '人力资源部' }],
    });
  });

  it('resolves employee-based executors without requiring internal accounts', async () => {
    const executor = { id: 'employee-1', name: '执行人', employeeNo: 'E001', workEmail: 'executor@example.invalid', mobile: null, user: null };
    const prisma = { employee: { findMany: jest.fn().mockResolvedValue([executor]) } };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    await expect((instance as any).resolveExecutorEmployees({ name: '人工模块', executor: { employeeIds: ['employee-1'] } })).resolves.toEqual([executor]);
  });

  it('allows scoped accountless employees to be saved as executors', async () => {
    const prisma = { employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-1' }]) } };
    const access = { getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
    const instance = new PerformanceService(prisma as never, access as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    await expect((instance as any).assertExecutorUserScope({ id: 'manager' }, { modules: [{ executor: { type: 'USER', employeeIds: ['employee-1'] } }] })).resolves.toBeUndefined();
  });

  it('allows an accountless employee selected by a directory executor', async () => {
    const prisma = { employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-1' }]) } };
    const access = { getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
    const instance = new PerformanceService(prisma as never, access as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    await expect((instance as any).assertExecutorUserScope({ id: 'manager' }, { modules: [{ name: '岗位评估', executor: { type: 'DIRECTORY', directoryType: 'POSITION', directoryId: 'position-1' } }] })).resolves.toBeUndefined();
  });

  it('keeps workflow definitions separate from assessment modules and requires an executor for every flow type', () => {
    const parser = new PerformanceTemplateParser();
    const parsed = parser.assertValidDefinition({
      schemaVersion: 1,
      name: '流程独立模板',
      modules: [{ id: 'evaluation', name: '人工模块', type: 'EVALUATION', enabled: true, participatesInTotal: true, weight: 100, description: '', executor: { type: 'USER', executionMode: 'SINGLE', employeeIds: ['employee-1'] }, indicators: [] }],
      workflow: { manualSteps: [{ id: 'review', name: 'HR 审核', type: 'REVIEW', executor: { type: 'USER', executionMode: 'SINGLE', employeeIds: ['employee-2'] }, rejectionStrategy: 'END' }, { id: 'confirm', name: '本人确认', type: 'CONFIRMATION', executor: { type: 'USER', executionMode: 'SINGLE', employeeIds: ['employee-3'] } }] },
    }, true);
    expect(parsed.modules).toHaveLength(1);
    expect(parsed.workflow?.manualSteps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'review', type: 'REVIEW' }),
      expect.objectContaining({ id: 'confirm', type: 'CONFIRMATION', executor: expect.objectContaining({ employeeIds: ['employee-3'] }) }),
    ]));
    expect(() => parser.assertValidDefinition({
      ...parsed,
      workflow: { manualSteps: [{ id: 'missing-executor', name: '无执行人步骤', type: 'CONFIRMATION' }] },
    }, true)).toThrow();
  });

  it('records an accountless employee notification using employee contact data', async () => {
    const feishu = { enabled: true, resolveOpenIdByContact: jest.fn().mockResolvedValue('ou_employee'), sendCardToOpenId: jest.fn().mockResolvedValue(true) };
    const prisma = {
      performanceModuleTask: { findUnique: jest.fn().mockResolvedValue({ id: 'task-1', moduleType: 'EVALUATION', moduleName: '人工模块', moduleSnapshot: {}, instance: { cycle: { name: '测试周期' }, employee: { name: '被评员工' } }, assignees: [{ id: 'assignee-1', employee: { workEmail: 'executor@example.invalid', mobile: null } }] }) },
      performanceAssessmentNotificationDelivery: { create: jest.fn().mockResolvedValue({ id: 'delivery-1' }), update: jest.fn().mockResolvedValue({}) },
      performanceModuleTaskAssignee: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const instance = new PerformanceService(prisma as never, {} as never, { create: jest.fn().mockResolvedValue(undefined) } as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, feishu as never);
    jest.spyOn(instance as any, 'issueAssessmentCardToken').mockResolvedValue('secret-token');
    await (instance as any).notifyTaskOpened('task-1');
    expect(feishu.resolveOpenIdByContact).toHaveBeenCalledWith({ workEmail: 'executor@example.invalid', mobile: null });
    expect(feishu.sendCardToOpenId).toHaveBeenCalledWith('ou_employee', expect.anything());
  });

  it('rejects starting an activity that has no assigned template or instances', async () => {
    const cycle = { id: 'cycle-draft', organizationId: 'org-root', templateId: null, templateVersionId: null, status: 'DRAFT', instances: [] };
    const prisma = { performanceCycle: { findUnique: jest.fn().mockResolvedValue(cycle) } };
    const access = { hasAllEmployeeData: jest.fn().mockReturnValue(true) };
    const instance = new PerformanceService(prisma as never, access as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    await expect(instance.startCycle({ id: 'user-1' } as never, 'cycle-draft')).rejects.toThrow('活动中没有可启动的被考核人');
  });
});

describe('PerformanceTemplateParser', () => {
  it('rejects scripts and requires a declarative block', () => {
    const parser = new PerformanceTemplateParser();
    expect(parser.parse('# x\n<script>alert(1)</script>').errors[0]?.message).toContain('未识别');
    expect(parser.parse(markdown).errors).toEqual([]);
  });

  it('accepts an explicitly configured manual template without Markdown', () => {
    const parser = new PerformanceTemplateParser();
    expect(() => parser.assertValidDefinition(definition)).not.toThrow();
  });

  it('rejects invalid fixed weights', () => {
    const parser = new PerformanceTemplateParser();
    const invalid = { ...definition, modules: definition.modules.map((module) => module.id === 'metric' ? { ...module, weight: 30 } : module) };
    expect(parser.parse(`# x\n\n\`\`\`performance-template\n${JSON.stringify(invalid)}\n\`\`\``).errors.some((error) => error.message.includes('100'))).toBe(true);
  });

  it('allows a metric definition without exposing a scoring rule in the HR template', () => {
    const parser = new PerformanceTemplateParser();
    const withoutRule = {
      ...definition,
      modules: definition.modules.map((module) => module.id === 'metric'
        ? { ...module, indicators: [{ ...module.indicators[0], dataField: undefined, rule: undefined }] }
        : module),
    };
    const errors: PerformanceParseError[] = [];
    expect(parser.validateDefinition(withoutRule, errors, true)).toMatchObject({ modules: expect.any(Array) });
    expect(errors).toEqual([]);
  });

  it('normalizes legacy single-user definitions and validates multiple execution', () => {
    const parser = new PerformanceTemplateParser();
    const legacy = parser.assertValidDefinition(definition);
    expect(legacy.modules[1]?.executor).toMatchObject({ type: 'USER', executionMode: 'SINGLE', userIds: ['user-1'] });
    const multiple = {
      ...definition,
      modules: definition.modules.map((module) => module.id === 'evaluation'
        ? { ...module, executor: { type: 'USER', executionMode: 'MULTIPLE', userIds: ['user-1', 'user-2'] } }
        : module),
    };
    expect(() => parser.assertValidDefinition(multiple, true)).not.toThrow();
    const incompleteMultiple = { ...multiple, modules: multiple.modules.map((module) => module.id === 'evaluation'
      ? { ...module, executor: { type: 'USER', executionMode: 'MULTIPLE', userIds: ['user-1'] } }
      : module) };
    const incompleteErrors: PerformanceParseError[] = [];
    expect(parser.validateDefinition(incompleteMultiple, incompleteErrors, true)).toBeNull();
    expect(incompleteErrors.some((error) => error.message.includes('至少两名'))).toBe(true);

    const multipleDirectory = { ...multiple, modules: multiple.modules.map((module) => module.id === 'evaluation'
      ? { ...module, executor: { type: 'DIRECTORY', executionMode: 'MULTIPLE', directoryType: 'POSITION', directoryId: 'position-1' } }
      : module) };
    const directoryErrors: PerformanceParseError[] = [];
    expect(parser.validateDefinition(multipleDirectory, directoryErrors, true)).toBeNull();
    expect(directoryErrors.some((error) => error.message.includes('只能单人'))).toBe(true);
  });
});

describe('PerformanceTemplate copying', () => {
  it('creates a separate draft template from the latest version', async () => {
    const source = { id: 'source-template', name: '原绩效模板', description: '说明', versions: [{ id: 'source-version', versionNo: 3, sourceName: 'source.md', sourceMarkdown: markdown, definition }] };
    const createdTemplate = { id: 'copied-template' };
    const copied = { id: 'copied-template', name: '原绩效模板 副本', description: '说明', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), versions: [{ id: 'copied-version', versionNo: 1, sourceName: 'source.md', sourceMarkdown: markdown, definition, status: 'DRAFT', createdAt: new Date(), publishedAt: null }] };
    const tx = { performanceTemplate: { create: jest.fn().mockResolvedValue(createdTemplate), findUniqueOrThrow: jest.fn().mockResolvedValue(copied) }, performanceTemplateVersion: { create: jest.fn().mockResolvedValue({}) } };
    const prisma = { performanceTemplate: { findFirst: jest.fn().mockResolvedValue(source) }, $transaction: jest.fn((callback) => callback(tx)) };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const instance = new PerformanceService(prisma as never, {} as never, audit as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const result = await instance.copyTemplate({ id: 'user-1' } as never, 'source-template');
    expect(tx.performanceTemplate.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: '原绩效模板 副本' }) }));
    expect(tx.performanceTemplateVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ templateId: 'copied-template', versionNo: 1, status: 'DRAFT', sourceMarkdown: markdown }) }));
    expect(result.sourceTemplateId).toBe('source-template');
  });
});

describe('PerformanceRuleEngine', () => {
  it('evaluates only whitelisted arithmetic and conditions', () => {
    const engine = new PerformanceRuleEngine();
    expect(engine.evaluate({ op: 'if', condition: { field: 'completionRate', operator: '>=', value: 1 }, then: { op: 'constant', value: 100 }, otherwise: { op: 'multiply', args: [{ op: 'field', field: 'completionRate' }, { op: 'constant', value: 100 }] } }, { completionRate: 0.75 })).toBe(75);
    expect(() => engine.evaluate({ op: 'divide', args: [{ op: 'constant', value: 1 }, { op: 'constant', value: 0 }] }, {})).toThrow(BadRequestException);
    expect(() => engine.evaluate({ op: 'field', field: 'completionRate; process.exit()' }, { completionRate: 1 })).toThrow(BadRequestException);
  });
});

describe('Employee personal performance amount bases', () => {
  it('freezes the latest personal base and recalculates from that snapshot', async () => {
    const personalBase = { id: 'base-2', amount: { toFixed: () => '3000', valueOf: () => 3000 } as never, versionNo: 2 };
    const prisma = { employeePerformanceAmountBase: { findFirst: jest.fn().mockResolvedValue(personalBase) } };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const snapshot = await (instance as any).resolveEmployeeAmountBaseSnapshot('employee-1', 85);
    expect(snapshot.employeeAmountBaseId).toBe('base-2');
    expect(snapshot.employeeAmountBaseVersionNo).toBe(2);
    expect(Number(snapshot.actualAmount)).toBe(2550);
  });

  it('rejects finalization where no personal amount base exists', async () => {
    const prisma = { employeePerformanceAmountBase: { findFirst: jest.fn().mockResolvedValue(null) } };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    await expect((instance as any).resolveEmployeeAmountBaseSnapshot('employee-1', 85)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not treat a non-adjustment auxiliary module as fixed-weight work', async () => {
    const prisma = { employeePerformanceAmountBase: { findFirst: jest.fn().mockResolvedValue({ id: 'base-1', amount: 1000, versionNo: 1 }) } };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const tasks = [
      { status: TaskStatus.COMPLETED, moduleType: PerformanceModuleType.EVALUATION, moduleWeight: 100 as never, moduleSnapshot: { enabled: true, participatesInTotal: true }, moduleScore: 80 as never },
      { status: TaskStatus.COMPLETED, moduleType: PerformanceModuleType.EVALUATION, moduleWeight: null, moduleSnapshot: { enabled: true, participatesInTotal: false }, moduleScore: 60 as never },
    ];

    await expect((instance as any).resultUpdate(tasks, 'employee-1')).resolves.toMatchObject({ fixedWeightedScore: expect.anything(), actualAmount: expect.anything() });
  });
});

describe('Performance metric execution', () => {
  it('rejects metric data that omits the template-declared business field', async () => {
    const task = {
      id: 'metric-task',
      employeeId: 'employee-1',
      moduleSnapshot: {
        name: '业务指标',
        indicators: [{ id: 'metric-1', name: '完成率', weight: 100, dataField: 'businessValue', rule: { op: 'field', field: 'businessValue' } }],
      },
    };
    const prisma = { performanceModuleTask: { update: jest.fn() } };
    const adapter = { getMetrics: jest.fn().mockResolvedValue([{ indicatorId: 'metric-1', targetValue: 1, actualValue: 1, weight: 100, fields: {} }]) };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), adapter, { enabled: false } as never);

    await expect((instance as any).executeMetricTask(task, new Date('2026-01-01'), new Date('2026-01-31'))).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Performance card callbacks', () => {
  it('registers a long-connection card action handler when provided', () => {
    const longConnection = { registerCardActionHandler: jest.fn() };
    service({} as never);
    new PerformanceService({} as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never, longConnection as never);
    expect(longConnection.registerCardActionHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('reads a top-level long-connection card action value', () => {
    const instance = new PerformanceService({} as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    expect((instance as any).cardActionPayload({ action: { value: { kind: 'assessment', token: 'token' } } })).toMatchObject({ kind: 'assessment', token: 'token' });
  });

  it('reads a long-connection action value nested in action actions', async () => {
    const instance = new PerformanceService({} as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    expect((instance as any).cardActionPayload({ event: { action: { actions: [{ value: { kind: 'assessment', token: 'token' } }] } } })).toMatchObject({ kind: 'assessment', token: 'token' });
  });

  it('returns a clear long-connection error when the card has no operator identity', async () => {
    const instance = new PerformanceService({} as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    await expect(instance.handleLongConnectionCardAction({ event: { action: { value: { kind: 'assessment', token: 'token' } } } })).resolves.toMatchObject({ toast: { type: 'error' } });
  });

  it('includes configured indicator standards in an evaluation card', () => {
    const instance = new PerformanceService({} as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const card = (instance as any).assessmentCard({
      moduleType: PerformanceModuleType.EVALUATION,
      moduleName: '人工模块',
      moduleSnapshot: { indicators: [{ name: '交付质量', description: '及时、准确完成', standards: ['按时交付', '结果准确'] }] },
      instance: { cycle: { name: '测试周期' }, employee: { name: '虚构员工' } },
    }, 'token');

    expect(card.body.elements.some((element: { content?: string }) => element.content?.includes('衡量标准') && element.content.includes('按时交付'))).toBe(true);
  });

  it('marks the evaluation card button as a Schema 2 form submit action', () => {
    const instance = new PerformanceService({} as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const card = (instance as any).assessmentCard({ moduleType: PerformanceModuleType.EVALUATION, moduleName: '人工模块', moduleSnapshot: {}, instance: { cycle: { name: '测试周期' }, employee: { name: '虚构员工' } } }, 'token');
    const form = card.body.elements[1];

    expect(form.elements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'submit_score',
        form_action_type: 'submit',
        behaviors: [{ type: 'callback', value: { kind: 'assessment', token: 'token', moduleType: PerformanceModuleType.EVALUATION } }],
      }),
    ]));
  });

  it('updates the source card after a successful persisted evaluation submission', async () => {
    const feishu = { enabled: true, resolveOpenIdByContact: jest.fn().mockResolvedValue('ou_employee'), updateCard: jest.fn().mockResolvedValue(true) };
    const assignee = { id: 'assignee-1', employee: { workEmail: 'executor@example.invalid', mobile: null }, task: { id: 'task-1', moduleType: PerformanceModuleType.EVALUATION, moduleSnapshot: {}, executionMode: 'SINGLE', instanceId: 'instance-1', employeeId: 'employee-1' } };
    const prisma = { performanceModuleTaskAssignee: { findFirst: jest.fn().mockResolvedValue(assignee) } };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, feishu as never);
    jest.spyOn(instance as any, 'submitAssessmentAssigneeScore').mockResolvedValue(undefined);

    await (instance as any).submitAssessmentCardAction({ token: 'token', value: '88', comment: '' }, 'ou_employee', undefined, 'message-1');

    expect(feishu.updateCard).toHaveBeenCalledWith('message-1', expect.objectContaining({ header: expect.objectContaining({ template: 'green' }) }));
  });
});

describe('Performance task personal notifications', () => {
  it('builds one activity-level card with aggregated counts and frozen workflow results', () => {
    const instance = new PerformanceService({} as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const card = (instance as any).feishuTaskInboxCard({
      cycleName: '测试活动',
      totalPending: 5,
      assessmentTasks: [{}, {}, {}],
      workflowTasks: [
        { employeeName: '甲', employeeNo: 'E001', stepName: '审核', finalScore: 88.5, actualAmount: 1770 },
        { employeeName: '乙', employeeNo: 'E002', stepName: '本人确认', finalScore: 92, actualAmount: 1840 },
      ],
    }, 'https://hr.example.invalid/inbox');

    expect(card.header.title.content).toBe('绩效活动待处理提醒');
    expect(card.body.elements[0].content).toContain('待提交评价**：3 项');
    expect(card.body.elements[0].content).toContain('待审核/流程处理**：2 项');
    expect(card.body.elements[0].content).toContain('最终得分：88.5000｜实际金额：1770.00');
    expect(card.body.elements[0].content).toContain('最终得分：92.0000｜实际金额：1840.00');
    expect(card.body.elements[1]).toMatchObject({ multi_url: { url: 'https://hr.example.invalid/inbox' } });
  });

  it('includes frozen score and amount in every direct workflow card', () => {
    const instance = new PerformanceService({} as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const card = (instance as any).workflowCard({
      stepName: 'HR 审核',
      stepType: 'REVIEW',
      instance: { finalScore: 88.5, actualAmount: 1770, cycle: { name: '测试活动' }, employee: { name: '虚构员工' } },
    }, 'token');

    expect(card.body.elements[0].content).toContain('最终得分**：88.5000');
    expect(card.body.elements[0].content).toContain('实际金额**：1770.00');
  });

  it('presents persisted workflow results without recalculating them', () => {
    const instance = new PerformanceService({} as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const result = (instance as any).presentWorkflowTask({
      id: 'workflow-1', instanceId: 'instance-1', stepId: 'review', stepName: '审核', stepType: 'REVIEW', stepOrder: 0, attemptNo: 1, status: 'IN_PROGRESS', executorNameSnapshot: '审核人', completedAt: null, assignees: [],
      instance: { cycleId: 'cycle-1', employeeId: 'employee-1', currentWorkflowOrder: 0, finalScore: 88.5, actualAmount: 1770, cycle: { name: '测试活动' }, employee: { name: '虚构员工', employeeNo: 'E001' } },
    });

    expect(result).toMatchObject({ finalScore: 88.5, actualAmount: 1770 });
  });

  it('opens each next workflow step after the frozen result already exists', async () => {
    const definitionWithSteps = { workflow: { manualSteps: [{ id: 'review', name: '审核', type: 'REVIEW' }, { id: 'confirm', name: '确认', type: 'CONFIRMATION' }] } };
    const tx = {
      performanceWorkflowTask: { update: jest.fn().mockResolvedValue({}) },
      performanceInstance: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      performanceInstance: { findUniqueOrThrow: jest.fn().mockResolvedValue({ definitionSnapshot: definitionWithSteps }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const audit = { create: jest.fn().mockResolvedValue(undefined) };
    const instance = new PerformanceService(prisma as never, {} as never, audit as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    const openWorkflowStep = jest.spyOn(instance as any, 'openWorkflowStep').mockResolvedValue(undefined);

    await (instance as any).completeWorkflowTask({ id: 'task-1', instanceId: 'instance-1', stepOrder: 0 }, null);

    expect(openWorkflowStep).toHaveBeenCalledWith('instance-1', 1);
  });

  it('refuses to open a workflow step before score and amount are generated', async () => {
    const prisma = { performanceInstance: { findUnique: jest.fn().mockResolvedValue({ assessmentStatus: ProcessStatus.COMPLETED, finalScore: null, actualAmount: null }) } };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);

    await expect((instance as any).openWorkflowStep('instance-1', 0)).rejects.toThrow('最终得分和实际金额生成后才能进入审核确认流程');
  });

  it('records a skipped delivery when Feishu is disabled', async () => {
    const feishu = { enabled: false, sendCardToOpenId: jest.fn(), resolveOpenIdByContact: jest.fn() };
    const prisma = {
      performanceModuleTask: { findUnique: jest.fn().mockResolvedValue({ id: 'task-1', moduleType: 'EVALUATION', assignees: [{ id: 'assignee-1', employee: { workEmail: 'fictional@example.invalid', mobile: null } }] }) },
      performanceAssessmentNotificationDelivery: { create: jest.fn().mockResolvedValue({ id: 'delivery-1' }), update: jest.fn().mockResolvedValue({}) },
    };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, feishu as never);
    await (instance as any).notifyTaskOpened('task-1');
    expect(prisma.performanceAssessmentNotificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED', deliveredAt: null }) }));
  });
});

describe('PerformanceService demo guard', () => {
  it('does not access Prisma in demo mode', async () => {
    const prisma = { performanceTemplate: { findMany: jest.fn() } };
    const service = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: true } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    expect(() => service.parseTemplate({ sourceMarkdown: markdown })).toThrow(ConflictException);
    expect(prisma.performanceTemplate.findMany).not.toHaveBeenCalled();
  });
});
