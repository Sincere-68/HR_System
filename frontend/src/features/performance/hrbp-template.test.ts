import { describe, expect, it } from 'vitest';
import {
  createInitialPerformanceTemplate,
  getFixedWeightTotal,
  getAssessmentWorkflowProjection,
  getPerformanceFlowItems,
  getIndicatorWeightTotal,
  normalizeMarkdownPerformanceModules,
  reorderPerformanceModules,
  reorderPerformanceWorkflowSteps,
} from './hrbp-template';

describe('performance template editor helpers', () => {
  it('starts a new template without hard-coded business modules', () => {
    const template = createInitialPerformanceTemplate();

    expect(template).toMatchObject({ name: '', sourceMarkdown: '', modules: [] });
  });

  it('sums enabled fixed module weights only', () => {
    expect(getFixedWeightTotal([
      { enabled: true, participatesInTotal: true, weight: 40 },
      { enabled: true, participatesInTotal: false, weight: null },
      { enabled: false, participatesInTotal: true, weight: 60 },
    ] as never)).toBe(40);
  });

  it('sums the declared weights of a module indicators', () => {
    expect(getIndicatorWeightTotal({
      indicators: [
        { weight: 40, weightLabel: '40%' },
        { weightLabel: '60%' },
      ],
    } as never)).toBe(100);
  });

  it('reorders modules by dragged source and target module ids', () => {
    const modules = [
      { id: 'first' },
      { id: 'second' },
      { id: 'third' },
    ] as never;

    expect(reorderPerformanceModules(modules, 'first', 'third').map((module) => module.id)).toEqual([
      'second',
      'first',
      'third',
    ]);
  });

  it('keeps quantitative assessment out of workflow and projects enabled manual scoring modules', () => {
    expect(getAssessmentWorkflowProjection([
      { id: 'metric', name: '定量考核', type: 'metric', enabled: true, participatesInTotal: true },
      { id: 'evaluation', name: '业务达成', type: 'evaluation', enabled: true, participatesInTotal: true },
      { id: 'adjustment', name: '结果调整', type: 'adjustment', enabled: true, participatesInTotal: false },
      { id: 'excluded', name: '不计分评估', type: 'evaluation', enabled: true, participatesInTotal: false },
      { id: 'disabled', name: '停用评估', type: 'evaluation', enabled: false, participatesInTotal: true },
    ] as never)).toEqual([
      { id: 'assessment:evaluation', name: '业务达成', source: 'ASSESSMENT', type: 'ASSESSMENT_EVALUATION' },
      { id: 'assessment:adjustment', name: '结果调整', source: 'ASSESSMENT', type: 'ASSESSMENT_ADJUSTMENT' },
    ]);
  });

  it('converts parsed business achievement into an executable evaluation without changing other parsed modules', () => {
    const modules = normalizeMarkdownPerformanceModules([
      {
        id: 'business-achievement',
        name: '业务达成',
        type: 'metric',
        enabled: true,
        participatesInTotal: true,
        weight: 10,
        responsibleRole: '系统自动计算',
        executor: { type: 'AUTO', executionMode: 'SINGLE' },
        description: '保留模块说明',
        indicators: [{ id: 'completion', name: '完成率', description: '', standards: [], weight: 100, weightLabel: '100%', source: '模板', dataField: 'completionRate', rule: { op: 'field', field: 'completionRate' } }],
      },
      {
        id: 'quantitative',
        name: '销售定量考核',
        type: 'metric',
        enabled: true,
        participatesInTotal: true,
        weight: 90,
        responsibleRole: '系统自动计算',
        executor: { type: 'AUTO', executionMode: 'SINGLE' },
        description: '',
        indicators: [],
      },
    ]);

    expect(modules[0]).toMatchObject({
      name: '业务达成',
      type: 'evaluation',
      weight: 10,
      executor: { type: 'USER', executionMode: 'SINGLE', employeeIds: [] },
      indicators: [{ id: 'completion' }],
    });
    expect(modules[0]?.indicators[0]).not.toHaveProperty('dataField');
    expect(modules[0]?.indicators[0]).not.toHaveProperty('rule');
    expect(modules[1]).toMatchObject({ name: '销售定量考核', type: 'metric', executor: { type: 'AUTO' } });
  });

  it('reorders manual workflow steps without touching assessment modules', () => {
    const steps = [{ id: 'review' }, { id: 'approval' }, { id: 'archive' }] as never;
    expect(reorderPerformanceWorkflowSteps(steps, 'review', 'archive').map((step) => step.id)).toEqual([
      'approval', 'review', 'archive',
    ]);
  });

  it('shows assessment projections and manual steps in one ordered flow list', () => {
    const items = getPerformanceFlowItems([
      { id: 'assessment', name: '直属经理评估', type: 'evaluation', enabled: true, participatesInTotal: true },
      { id: 'metric', name: '定量考核', type: 'metric', enabled: true, participatesInTotal: true },
    ] as never, [{ id: 'review', name: 'HR 审核', type: 'REVIEW', executor: { type: 'USER', employeeIds: ['employee-1'] } }] as never);

    expect(items.map((item) => item.itemId)).toEqual(['assessment:assessment', 'manual:review']);
  });
});
