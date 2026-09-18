import { describe, expect, it } from 'vitest';
import {
  createInitialPerformanceTemplate,
  getFixedWeightTotal,
  getAssessmentWorkflowProjection,
  getPerformanceFlowItems,
  getIndicatorWeightTotal,
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

  it('projects only enabled manual assessment and adjustment modules into workflow', () => {
    expect(getAssessmentWorkflowProjection([
      { id: 'metric', name: '业务指标', type: 'metric', enabled: true },
      { id: 'evaluation', name: '直属经理评估', type: 'evaluation', enabled: true },
      { id: 'adjustment', name: '结果调整', type: 'adjustment', enabled: true },
      { id: 'disabled', name: '停用评估', type: 'evaluation', enabled: false },
    ] as never)).toEqual([
      { id: 'assessment:evaluation', name: '直属经理评估', source: 'ASSESSMENT', type: 'ASSESSMENT_EVALUATION' },
      { id: 'assessment:adjustment', name: '结果调整', source: 'ASSESSMENT', type: 'ASSESSMENT_ADJUSTMENT' },
    ]);
  });

  it('reorders manual workflow steps without touching assessment modules', () => {
    const steps = [{ id: 'review' }, { id: 'approval' }, { id: 'archive' }] as never;
    expect(reorderPerformanceWorkflowSteps(steps, 'review', 'archive').map((step) => step.id)).toEqual([
      'approval', 'review', 'archive',
    ]);
  });

  it('shows assessment projections and manual steps in one ordered flow list', () => {
    const items = getPerformanceFlowItems([
      { id: 'assessment', name: '直属经理评估', type: 'evaluation', enabled: true },
      { id: 'metric', name: '自动指标', type: 'metric', enabled: true },
    ] as never, [{ id: 'review', name: 'HR 审核', type: 'REVIEW', executor: { type: 'USER', employeeIds: ['employee-1'] } }] as never);

    expect(items.map((item) => item.itemId)).toEqual(['assessment:assessment', 'manual:review']);
  });
});
