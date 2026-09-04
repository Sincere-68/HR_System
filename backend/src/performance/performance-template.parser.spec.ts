import { PerformanceTemplateParser } from './performance-template.parser';

describe('PerformanceTemplateParser generic Markdown', () => {
  it('parses an overview table with arbitrary module names and weights', () => {
    const markdown = `# 视觉创意部新版绩效 V1\n\n## 二、考核指标总览\n\n| 目标分类 | 目标维度 | 权重占比 | 关键事项 / 行动计划 |\n|---|---|---:|---|\n| 运营指标（50%） | 渠道销售额 | 20% | 项目达成 |\n| 运营指标（50%） | 时效性 | 40% | 项目管理 |\n| 专业指标（50%） | 专业能力 | 60% | 稳定输出 |\n| 专业指标（50%） | 设计质量 | 20% | 控制风险 |\n| 其他工作（20%） | 额外其他工作 | 20% | 品牌支持 |`;
    const result = new PerformanceTemplateParser().parse(markdown);
    expect(result.errors).toEqual([]);
    expect(result.definition?.name).toBe('视觉创意部新版绩效 V1');
    expect(result.definition?.modules.map((module) => [module.name, module.weight])).toEqual([
      ['运营指标', 60],
      ['专业指标', 80],
      ['其他工作', null],
    ]);
    expect(result.definition?.modules[2]).toMatchObject({ type: 'ADJUSTMENT', participatesInTotal: false, adjustmentDirection: 'ADD', adjustmentMax: 20 });
    expect(result.definition?.modules[0]?.indicators.map((indicator) => [indicator.name, indicator.weight])).toEqual([
      ['渠道销售额', 20],
      ['时效性', 40],
    ]);
    expect(result.warnings.some((warning) => warning.message.includes('未根据名称自动推断'))).toBe(true);
    expect(result.warnings.some((warning) => warning.message.includes('额外加分项'))).toBe(true);
  });
});
