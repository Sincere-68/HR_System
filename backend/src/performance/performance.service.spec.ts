import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PerformanceModuleType, PerformanceExecutorType, TaskStatus } from '@prisma/client';
import { PerformanceRuleEngine } from './performance-rule-engine';
import { PerformanceTemplateParser } from './performance-template.parser';
import { PerformanceService } from './performance.service';

const definition = {
  schemaVersion: 1,
  name: '虚构绩效模板',
  modules: [
    { id: 'metric', name: '指标模块', type: 'METRIC', enabled: true, participatesInTotal: true, weight: 50, description: '', executor: { type: 'AUTO' }, indicators: [{ id: 'completion', name: '完成率', description: '', standards: [], weight: 100, rule: { op: 'field', field: 'completionRate' } }] },
    { id: 'evaluation', name: '人工模块', type: 'EVALUATION', enabled: true, participatesInTotal: true, weight: 50, description: '', executor: { type: 'USER', userId: 'user-1' }, indicators: [] },
  ],
} as const;
const markdown = `# 测试\n\n\`\`\`performance-template\n${JSON.stringify(definition)}\n\`\`\``;

function service(overrides: Record<string, unknown> = {}) {
  const prisma = { performanceTemplate: {}, performanceTemplateVersion: {}, performanceCycle: {}, performanceInstance: {}, performanceModuleTask: {}, performanceResultRevision: {}, performanceAmountBaseVersion: {}, employee: {}, user: {}, $transaction: jest.fn(), ...overrides };
  const access = { getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null), hasPermission: jest.fn().mockReturnValue(true) };
  const demo = { enabled: false };
  const audit = { create: jest.fn().mockResolvedValue(undefined) };
  return new PerformanceService(prisma as never, access as never, audit as never, demo as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() });
}

describe('PerformanceTemplateParser', () => {
  it('rejects scripts and requires a declarative block', () => {
    const parser = new PerformanceTemplateParser();
    expect(parser.parse('# x\n<script>alert(1)</script>').errors[0]?.message).toContain('缺少');
    expect(parser.parse(markdown).errors).toEqual([]);
  });

  it('rejects invalid fixed weights', () => {
    const parser = new PerformanceTemplateParser();
    const invalid = { ...definition, modules: definition.modules.map((module) => module.id === 'metric' ? { ...module, weight: 30 } : module) };
    expect(parser.parse(`# x\n\n\`\`\`performance-template\n${JSON.stringify(invalid)}\n\`\`\``).errors.some((error) => error.message.includes('100'))).toBe(true);
  });
});

describe('PerformanceRuleEngine', () => {
  it('evaluates only whitelisted arithmetic and conditions', () => {
    const engine = new PerformanceRuleEngine();
    expect(engine.evaluate({ op: 'if', condition: { field: 'completionRate', operator: '>=', value: 1 }, then: { op: 'constant', value: 100 }, otherwise: { op: 'multiply', args: [{ op: 'field', field: 'completionRate' }, { op: 'constant', value: 100 }] } }, { completionRate: 0.75 })).toBe(75);
    expect(() => engine.evaluate({ op: 'divide', args: [{ op: 'constant', value: 1 }, { op: 'constant', value: 0 }] }, {})).toThrow(BadRequestException);
  });
});

describe('PerformanceService demo guard', () => {
  it('does not access Prisma in demo mode', async () => {
    const prisma = { performanceTemplate: { findMany: jest.fn() } };
    const service = new PerformanceService(prisma as never, {} as never, {} as never, { enabled: true } as never, new PerformanceTemplateParser(), new PerformanceRuleEngine(), { getMetrics: jest.fn() });
    expect(() => service.parseTemplate({ sourceMarkdown: markdown })).toThrow(ConflictException);
    expect(prisma.performanceTemplate.findMany).not.toHaveBeenCalled();
  });
});
