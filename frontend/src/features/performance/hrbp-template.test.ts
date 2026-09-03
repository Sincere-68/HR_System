import { describe, expect, it } from 'vitest';
import {
  getFixedWeightTotal,
  parsedHrbpPerformanceTemplate,
  reorderPerformanceModules,
} from './hrbp-template';

describe('HRBP performance Markdown parser', () => {
  it('extracts fixed module weights from the total formula', () => {
    const fixedModules = parsedHrbpPerformanceTemplate.modules.filter((module) => module.participatesInTotal);

    expect(fixedModules.map((module) => [module.name, module.weight])).toEqual([
      ['业务达成', 10],
      ['业务负责人评价', 40],
      ['BP负责人评价', 50],
    ]);
    expect(getFixedWeightTotal(parsedHrbpPerformanceTemplate.modules)).toBe(100);
  });

  it('keeps deductions and rewards out of the fixed-weight total', () => {
    const adjustmentModules = parsedHrbpPerformanceTemplate.modules.filter((module) => module.type === 'adjustment');

    expect(adjustmentModules).toHaveLength(2);
    expect(adjustmentModules.every((module) => !module.participatesInTotal)).toBe(true);
  });

  it('detects an invalid fixed-weight total before a template can be saved', () => {
    const invalidModules = parsedHrbpPerformanceTemplate.modules.map((module) => (
      module.name === '业务达成' ? { ...module, weight: 20 } : module
    ));

    expect(getFixedWeightTotal(invalidModules)).toBe(110);
  });

  it('attaches each Markdown scoring explanation to its corresponding grade', () => {
    const businessOwner = parsedHrbpPerformanceTemplate.modules.find((module) => module.name === '业务负责人评价');
    const businessAchievement = parsedHrbpPerformanceTemplate.modules.find((module) => module.name === '业务达成');
    const bpOwner = parsedHrbpPerformanceTemplate.modules.find((module) => module.name === 'BP负责人评价');

    expect(businessOwner?.indicators.map((indicator) => [indicator.name, indicator.weightLabel])).toEqual([
      ['招聘与团队管理支持', '50%'],
      ['业务支持与问题闭环', '50%'],
    ]);
    expect(businessAchievement?.indicators[0]?.standards).toContain('完成率 ≥ 100%：按 100 分计算');
    expect(businessAchievement?.indicators[0]?.standards).toContain('完成率低于 50%：不按 0 分，按实际完成计算');
    expect(businessOwner?.indicators[0]?.standards[0]).toContain('评分说明：招聘需求理解准确，关键岗位推进及时');
    expect(businessOwner?.indicators[1]?.standards[3]).toContain('评分说明：对业务需求响应慢或理解偏差较大');
    expect(bpOwner?.indicators[0]?.standards[0]).toContain('评分说明：重点工作按时完成');
    expect(bpOwner?.indicators[1]?.standards[0]).toContain('评分说明：能主动发现问题并提出解决方案');
  });

  it('reorders modules by dragged source and target module ids', () => {
    const reordered = reorderPerformanceModules(
      parsedHrbpPerformanceTemplate.modules,
      'bp-owner-review',
      'business-achievement',
    );

    expect(reordered.map((module) => module.id).slice(0, 3)).toEqual([
      'bp-owner-review',
      'business-achievement',
      'business-owner-review',
    ]);

    const movedDown = reorderPerformanceModules(
      parsedHrbpPerformanceTemplate.modules,
      'business-achievement',
      'bp-owner-review',
    );
    expect(movedDown.map((module) => module.id).slice(0, 3)).toEqual([
      'business-owner-review',
      'business-achievement',
      'bp-owner-review',
    ]);
  });
});
