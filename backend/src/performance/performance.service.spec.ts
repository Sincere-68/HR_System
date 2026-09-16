import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PerformanceExceptionHandlerType, PerformanceModuleType, PerformanceExecutorType, RecordStatus, TaskStatus } from '@prisma/client';
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
      performanceInstance: { create: jest.fn().mockResolvedValue({ id: 'instance-1' }) },
      performanceModuleTask: { create: jest.fn().mockResolvedValue({}) },
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
    expect(tx.performanceInstance.create).toHaveBeenCalledTimes(2);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'handler-1' }) }));
    expect(result).toMatchObject({ organizationId: 'org-root', organizationName: '根组织', isPublic: true, createdByName: '创建人', exceptionHandlerEmployeeNo: 'E001', instanceCount: 2 });
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

describe('Performance template archive and draft activities', () => {
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

  it('notifies accountless employee assignees using employee contact data', async () => {
    const feishu = { enabled: true, resolveOpenIdByContact: jest.fn().mockResolvedValue('ou_employee'), sendTextToOpenId: jest.fn().mockResolvedValue(true) };
    const prisma = {
      performanceModuleTask: { findUnique: jest.fn().mockResolvedValue({ moduleType: 'EVALUATION', moduleName: '人工模块', instance: { cycle: { name: '测试周期' }, employee: { name: '被评员工' } }, assignees: [{ employee: { workEmail: 'executor@example.invalid', mobile: null } }] }) },
    };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, feishu as never);
    await (instance as any).notifyTaskOpened('task-1');
    expect(feishu.resolveOpenIdByContact).toHaveBeenCalledWith({ workEmail: 'executor@example.invalid', mobile: null });
    expect(feishu.sendTextToOpenId).toHaveBeenCalledWith('ou_employee', expect.stringContaining('人工模块'));
  });

  it('keeps an activity without a template in draft and blocks starting it', async () => {
    const cycle = { id: 'cycle-draft', organizationId: 'org-root', templateId: null, templateVersionId: null, status: 'DRAFT', instances: [] };
    const prisma = { performanceCycle: { findUnique: jest.fn().mockResolvedValue(cycle) } };
    const access = { hasAllEmployeeData: jest.fn().mockReturnValue(true) };
    const instance = new PerformanceService(prisma as never, access as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, { enabled: false } as never);
    await expect(instance.startCycle({ id: 'user-1' } as never, 'cycle-draft')).rejects.toBeInstanceOf(BadRequestException);
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
});

describe('Performance task personal notifications', () => {
  it('does not push a task when Feishu is disabled', async () => {
    const feishu = { enabled: false, sendTextToOpenId: jest.fn(), resolveOpenIdByContact: jest.fn() };
    const prisma = { performanceModuleTask: { findUnique: jest.fn() } };
    const instance = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: false } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() }, feishu as never);
    await (instance as any).notifyTaskOpened('task-1');
    expect(prisma.performanceModuleTask.findUnique).not.toHaveBeenCalled();
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
