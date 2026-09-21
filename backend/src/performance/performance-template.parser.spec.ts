import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PerformanceTemplateParser } from './performance-template.parser';

describe('PerformanceTemplateParser generic Markdown', () => {
  it('parses the extracted assessment-indicator document without turning its title into a module', () => {
    const markdown = readFileSync(resolve(__dirname, '../../../考核指标.md'), 'utf8');
    const result = new PerformanceTemplateParser().parse(markdown, '考核指标.md');

    expect(result.errors).toEqual([]);
    expect(result.definition).toMatchObject({ name: '考核指标' });
    expect(result.definition?.modules.map((module) => [module.name, module.weight, module.type])).toEqual([
      ['业务达成', 10, 'METRIC'],
      ['bp自评', 8, 'EVALUATION'],
      ['业务负责人评估', 32, 'EVALUATION'],
      ['BP负责人评估', 50, 'EVALUATION'],
      ['超额贡献', null, 'ADJUSTMENT'],
      ['工作失误扣减', null, 'ADJUSTMENT'],
    ]);

    const business = result.definition?.modules[0];
    expect(business?.indicators).toMatchObject([{
      name: '业务达成',
      weight: 100,
      description: '与部门一号位考核保持一致',
      standards: [
        '完成率≥100%，按100分计算',
        '完成率＜100%，按实际完成率计算',
        '如年底达成，则与前台一致补绩效',
      ],
    }]);

    const businessOwner = result.definition?.modules[2];
    expect(businessOwner?.indicators.map((indicator) => indicator.name)).toEqual(['招聘与团队管理支持', '业务支持与问题闭环']);
    expect(businessOwner?.indicators[0]?.standards[0]).toContain('评分说明：招聘需求理解准确，关键岗位推进及时');
    expect(businessOwner?.indicators[1]?.standards[3]).toContain('评分说明：对业务需求响应慢或理解偏差较大');

    const bpOwner = result.definition?.modules[3];
    expect(bpOwner?.indicators.map((indicator) => indicator.name)).toEqual(['工作交付质量', '主动推进与复杂事项处理']);
    expect(bpOwner?.indicators[0]?.standards[0]).toContain('评分说明：重点工作按时完成');
    expect(bpOwner?.indicators[1]?.standards[0]).toContain('评分说明：能主动发现问题并提出解决方案');
    expect(result.warnings.some((warning) => warning.message.includes('已忽略“bp自评”'))).toBe(false);
  });

  it('uses a module overview table and section hierarchy without treating background chapters as modules', () => {
    const markdown = `# HRBP 分工及绩效 V3

## 一、HRBP 分工总览

| BP | 负责范围 |
|---|---|
| 甲 | 销售团队 |

## 二、绩效设计核心逻辑

### 1. 月度绩效结构

| 模块 | 权重 / 类型 | 评分口径 |
|---|---:|---|
| 业务达成 | 10% | 百分制，最高 100 分 |
| 业务负责人评价 | 40% | 两个维度，各按百分制评分 |
| BP 负责人评价 | 50% | BP 负责人综合评分 |
| 工作失误扣减 | 额外扣减 | 有明确事实才扣分 |
| 奖励超额贡献 | 额外加分 | 原则上每月最高 20 分 |

## 三、业务达成｜占比 10%～25%（按照业务实际发展情况）

### 1. 计分规则

| 业务完成情况 | 计分规则 |
|---|---|
| 完成率 ≥ 100% | 按 100 分计算 |
| 完成率 ＜ 100% | 按实际完成率计算 |

### 2. 特殊口径

| 情形 | 处理方式 |
|---|---|
| 完成率低于 50% | 不按 0 分，按实际完成计算 |

## 四、业务负责人评价｜占比 40%

### 1. 评价结构

| 评价维度 | 权重 | 评分方式 |
|---|---:|---|
| 招聘与团队管理支持 | 50% | 百分制，四档评分 |
| 业务支持与问题闭环 | 50% | 百分制，四档评分 |

### 2. 招聘与团队管理支持

| 分数 | 判断 | 关键词 |
|---:|---|---|
| 95-100 分 | 优秀 | 主动、稳定、闭环 |

**评分说明：**

- **优秀**：招聘需求理解准确，关键岗位推进及时。

## 五、BP 负责人评价｜占比 50%

### 1. 评价维度

| 评价维度 | 看什么 |
|---|---|
| 工作交付质量 | 工作是否按要求完成，结果是否稳定 |
| 主动推进与复杂事项处理 | 是否主动发现问题，并推动问题闭环 |

**工作交付质量评分说明：**

- **优秀：** 重点工作按时完成，交付结果可直接使用。

## 六、工作失误扣减与奖励超额贡献

### 1. 工作失误扣减

| 情形 | 扣减分值 |
|---|---:|
| 一般工作失误，未造成明显影响 | 3 分 |

### 2. 奖励超额贡献

原则上每月最高 20 分。

| 奖励情形 | 分值梯队 |
|---|---:|
| 重点项目或额外任务贡献 | 5-10 分 |`;

    const result = new PerformanceTemplateParser().parse(markdown, 'HRBP分工及绩效V1.md');

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.definition?.modules.map((module) => [module.name, module.type, module.weight])).toEqual([
      ['业务达成', 'METRIC', 10],
      ['业务负责人评价', 'EVALUATION', 40],
      ['BP 负责人评价', 'EVALUATION', 50],
      ['工作失误扣减', 'ADJUSTMENT', null],
      ['奖励超额贡献', 'ADJUSTMENT', null],
    ]);

    const business = result.definition?.modules[0];
    expect(business?.indicators).toMatchObject([{
      name: '业务达成',
      weight: 100,
      standards: expect.arrayContaining(['完成率 ≥ 100%；按 100 分计算', '完成率 ＜ 100%；按实际完成率计算']),
    }]);

    const businessOwner = result.definition?.modules[1];
    expect(businessOwner?.indicators).toMatchObject([{
      name: '招聘与团队管理支持',
      weight: 50,
      standards: expect.arrayContaining(['95-100 分；优秀；主动、稳定、闭环', '优秀：招聘需求理解准确，关键岗位推进及时。']),
    }, {
      name: '业务支持与问题闭环',
      weight: 50,
    }]);

    const bpOwner = result.definition?.modules[2];
    expect(bpOwner?.indicators).toEqual(expect.arrayContaining([expect.objectContaining({
      name: '工作交付质量',
      description: expect.stringContaining('结果是否稳定'),
      standards: expect.arrayContaining(['优秀：重点工作按时完成，交付结果可直接使用。']),
    })]));

    expect(result.definition?.modules[3]).toMatchObject({ adjustmentDirection: 'DEDUCT', adjustmentMax: 100 });
    expect(result.definition?.modules[4]).toMatchObject({ adjustmentDirection: 'ADD', adjustmentMax: 20 });
  });

  it('falls back to Markdown tables when a generic JSON sample is invalid', () => {
    const markdown = `# Markdown 模板\n\n\`\`\`json\n{ invalid sample }\n\`\`\`\n\n| 目标分类 | 目标维度 | 权重占比 | 关键事项 / 行动计划 |\n|---|---|---:|---|\n| 交付（100%） | 质量 | 100% | 按时交付 |`;

    const result = new PerformanceTemplateParser().parse(markdown);

    expect(result.errors).toEqual([]);
    expect(result.definition?.modules).toMatchObject([{ name: '交付', weight: 100 }]);
  });

  it('parses a generic JSON fence with CRLF line endings', () => {
    const definition = {
      schemaVersion: 1,
      name: '通用 JSON 模板',
      modules: [{ id: 'evaluation', name: '人工评价', type: 'EVALUATION', enabled: true, participatesInTotal: true, weight: 100, description: '', executor: { type: 'USER', executionMode: 'SINGLE', userIds: ['user-1'] }, indicators: [] }],
    };
    const markdown = `\`\`\`json\r\n${JSON.stringify(definition)}\r\n\`\`\``;

    const result = new PerformanceTemplateParser().parse(markdown);

    expect(result.errors).toEqual([]);
    expect(result.definition).toMatchObject({ name: '通用 JSON 模板' });
  });

  it('parses a top-level heading without inferring its module type', () => {
    const result = new PerformanceTemplateParser().parse(`# 自定义绩效模块（100%）\n\n| 指标 | 权重 |\n|---|---:|\n| 交付质量 | 100% |`);

    expect(result.errors).toEqual([]);
    expect(result.definition?.modules).toMatchObject([{
      name: '自定义绩效模块',
      type: 'EVALUATION',
      weight: 100,
    }]);
    expect(result.warnings.some((warning) => warning.message.includes('未根据标题自动推断'))).toBe(false);
  });

  it('parses tables that use inert HTML line breaks', () => {
    const markdown = `# HTML 表格模板\n\n| 模块 | 指标 | 权重 |\n|---|---|---:|\n| 交付（100%） | 质量<br/>及时性 | 100% |`;

    const result = new PerformanceTemplateParser().parse(markdown);

    expect(result.errors).toEqual([]);
    expect(result.definition?.modules).toMatchObject([{ name: '交付', indicators: [{ name: expect.stringContaining('质量'), weight: 100 }] }]);
  });

  it('uses the nearest heading when an indicator-weight table has no module column', () => {
    const markdown = `# 灵活模板\n\n## 服务质量（100%）\n\n| 事项 | 比例 |\n|---|---:|\n| 响应及时性 | 100% |`;

    const result = new PerformanceTemplateParser().parse(markdown);

    expect(result.errors).toEqual([]);
    expect(result.definition?.modules).toMatchObject([{ name: '服务质量', indicators: [{ name: '响应及时性', weight: 100 }] }]);
  });

  it('parses flexible table headers and skips separator rows', () => {
    const markdown = `# 灵活模板\n\n| 考核模块 | 指标名称 | 权重 | 指标描述 |\n| :--- | :--- | ---: | :--- |\n| 服务质量（100%） | 响应及时性 | 100% | 及时处理事项 |`;

    const result = new PerformanceTemplateParser().parse(markdown);

    expect(result.errors).toEqual([]);
    expect(result.definition?.modules[0]).toMatchObject({
      name: '服务质量',
      weight: 100,
      indicators: [{ name: '响应及时性', description: '及时处理事项', weight: 100 }],
    });
  });

  it('parses indicator headings whose weight and standards are written in the body', () => {
    const markdown = `# 人力绩效模板

## 业务达成模块权重:10%

### 业务达成

- 权重：10%
- 指标描述：

与部门一号位考核保持一致

- 衡量标准：

1. 完成率≥100%，按100分计算
2. 完成率＜100%，按实际完成率计算`;

    const result = new PerformanceTemplateParser().parse(markdown);

    expect(result.errors).toEqual([]);
    expect(result.definition?.modules).toMatchObject([{
      name: '业务达成',
      weight: 10,
      indicators: [{
        name: '业务达成',
        weight: 100,
        description: '与部门一号位考核保持一致',
        standards: ['完成率≥100%，按100分计算', '完成率＜100%，按实际完成率计算'],
      }],
    }]);
  });

  it('accepts fourth-level indicator headings under a nested module heading', () => {
    const markdown = `# 部门绩效模板

## 部门自评

### 部门考核模块权重:50%

#### 部门考核

- 权重：100%
- 衡量标准：

默认`;

    const result = new PerformanceTemplateParser().parse(markdown);

    expect(result.errors).toEqual([]);
    expect(result.definition?.modules).toMatchObject([{
      name: '部门自评',
    }, {
      name: '部门考核',
      weight: 50,
      indicators: [{ name: '部门考核', weight: 100, standards: ['默认'] }],
    }]);
  });

  it('parses an overview table with arbitrary module names and weights', () => {
    const markdown = `# 视觉创意部新版绩效 V1\n\n## 二、考核指标总览\n\n| 目标分类 | 目标维度 | 权重占比 | 关键事项 / 行动计划 |\n|---|---|---:|---|\n| 运营指标（50%） | 渠道销售额 | 20% | 项目达成 |\n| 运营指标（50%） | 时效性 | 40% | 项目管理 |\n| 专业指标（50%） | 专业能力 | 60% | 稳定输出 |\n| 专业指标（50%） | 设计质量 | 20% | 控制风险 |\n| 其他工作（20%） | 额外其他工作 | 20% | 品牌支持 |`;
    const result = new PerformanceTemplateParser().parse(markdown);
    expect(result.errors).toEqual([]);
    expect(result.definition?.name).toBe('视觉创意部新版绩效 V1');
    expect(result.definition?.modules.map((module) => [module.name, module.weight])).toEqual([
      ['运营指标', 60],
      ['专业指标', 80],
      ['其他工作', 20],
    ]);
    expect(result.definition?.modules[2]).toMatchObject({ type: 'EVALUATION', participatesInTotal: true });
    expect(result.definition?.modules[0]?.indicators.map((indicator) => [indicator.name, indicator.weight])).toEqual([
      ['渠道销售额', 20],
      ['时效性', 40],
    ]);
    expect(result.warnings.some((warning) => warning.message.includes('未根据名称自动推断'))).toBe(true);
    expect(result.warnings.some((warning) => warning.message.includes('额外加分项'))).toBe(false);
  });
});
