export type PerformanceModuleKind = 'metric' | 'evaluation' | 'adjustment';

export interface PerformanceIndicator {
  id: string;
  name: string;
  description: string;
  standards: string[];
  weightLabel: string;
  weight?: number;
  dataField?: string;
  rule?: import('@hr-demo/shared').PerformanceRuleNode;
  source: string;
}

export interface PerformanceTemplateModule {
  id: string;
  name: string;
  type: PerformanceModuleKind;
  responsibleRole: string;
  executor: {
    type: 'AUTO' | 'USER' | 'DIRECTORY';
    userId?: string;
    directoryType?: 'POSITION' | 'JOB_TITLE';
    directoryId?: string;
  };
  enabled: boolean;
  participatesInTotal: boolean;
  weight: number | null;
  description: string;
  indicators: PerformanceIndicator[];
  requireComment?: boolean;
  requireAttachment?: boolean;
  adjustmentDirection?: 'ADD' | 'DEDUCT';
  adjustmentMin?: number;
  adjustmentMax?: number;
}

export interface ParsedPerformanceTemplate {
  id: string;
  name: string;
  sourceName: string;
  sourceMarkdown: string;
  modules: PerformanceTemplateModule[];
}

const businessModuleId = 'business-achievement';
const businessOwnerModuleId = 'business-owner-review';
const bpOwnerModuleId = 'bp-owner-review';
const deductionModuleId = 'work-mistake-deduction';
const rewardModuleId = 'extra-contribution-reward';

export const performanceRoleOptions = [
  '系统自动计算',
  '员工本人',
  '直接上级',
  '业务负责人',
  'BP负责人',
  '部门负责人',
  '指定审批人',
];

export const hrbpPerformanceV3Markdown = `# HRBP 分工及绩效 V3

## 二、绩效设计核心逻辑

### 1. 月度绩效结构

| 模块 | 权重 / 类型 | 评分口径 |
|---|---:|---|
| 业务达成 | 10% | 百分制，最高 100 分 |
| 业务负责人评价 | 40% | 两个维度，各按百分制评分 |
| BP 负责人评价 | 50% | BP 负责人综合评分 |
| 工作失误扣减 | 额外扣减 | 有明确事实才扣分 |
| 奖励超额贡献 | 额外加分 | 原则上每月最高 20 分 |

### 3. 总公式

月度绩效分 = 业务达成评分 × 10% + 业务负责人评价分 × 40% + BP负责人评价分 × 50% - 工作失误扣减分 + 奖励超额贡献加分

## 三、业务达成｜占比 10%～25%（按照业务实际发展情况）

### 1. 计分规则

| 业务完成情况 | 计分规则 |
|---|---|
| 完成率 ≥ 100% | 按 100 分计算 |
| 完成率 ＜ 100% | 按实际完成率计算 |

### 2. 特殊口径

| 情形 | 处理方式 |
|---|---|
| 各业务端口 | 与部门一号位考核保持一致 |
| 完成率低于 50% | 不按 0 分，按实际完成计算 |
| 闫禹凝 | 背所有业务指标，取均值评估 |
| 前台业务年底达成 | 如年底达成，则与前台一致补绩效 |

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
| 80-95 分 | 良好 | 达标、少量提醒 |
| 80-60 分 | 待提升 | 不稳定、需推动 |
| 0 分 | 不达标 | 缺失、影响管理 |

**评分说明：**

- **优秀**：招聘需求理解准确，关键岗位推进及时；候选人质量较高；能主动协助业务负责人处理员工沟通、绩效跟进、团队稳定等事项。
- **良好：** 招聘和团队管理支持基本达标；岗位推进、员工沟通、绩效跟进能按要求完成，偶有反馈不够及时或主动性不足。
- **待提升：** 招聘推进节奏、候选人匹配度或反馈及时性不稳定；团队管理问题能处理，但需要业务负责人提醒推动。
- **不达标：** 招聘支持不到位，关键岗位长期无有效推进；员工沟通、绩效跟进或团队稳定事项处理不及时，并已影响业务管理。

### 3. 业务支持与问题闭环

| 分数 | 判断 | 关键词 |
|---:|---|---|
| 95-100 分 | 优秀 | 理解深入、主动闭环 |
| 80-95 分 | 良好 | 支持稳定、基本闭环 |
| 80-60 分 | 待提升 | 推进不稳、需提醒 |
| 0 分 | 不达标 | 响应慢、无闭环 |

**评分说明：**

- **优秀：** 能快速理解业务需求和问题背景，响应及时；能主动协调相关方解决问题；复杂事项有过程反馈、有结果闭环。
- **良好：** 能及时响应业务需求，理解主要问题并推动处理；大部分事项能闭环，偶有反馈不完整或推进节奏不够快。
- **待提升**：能处理常规问题，但对业务背景理解不够深入；部分事项停留在沟通层面，需要业务负责人提醒才能完成闭环。
- **不达标：** 对业务需求响应慢或理解偏差较大；关键问题未及时处理或处理不当，导致业务被动、投诉或管理问题扩大。

## 五、BP 负责人评价｜占比 50%

### 1. 评价维度

| 评价维度 | 看什么 |
|---|---|
| 工作交付质量 | 工作是否按要求完成，结果是否稳定 |
| 主动推进与复杂事项处理 | 是否主动发现问题，并推动问题闭环 |

### 2. 评价内容颗粒度

| 评价维度 | 具体内容 |
|---|---|
| 工作交付质量 | 重点工作、临时事项、数据材料、方案输出、流程执行、结果准确性 |
| 主动推进与复杂事项处理 | 主动发现、推动闭环、复盘改进、跨部门协调、复杂事项处理 |

### 3. 评分档位

| 分数 | 判断 | 关键词 |
|---:|---|---|
| 95-100 分 | 优秀 | 高质量、主动、可复用 |
| 80-95 分 | 良好 | 基本达标、少量调整 |
| 80-60 分 | 待提升 | 不稳定、需提醒 |
| 0 分 | 不达标 | 未完成、影响结果 |

**工作交付质量评分说明：**

- **优秀：** 重点工作按时完成；项目和临时事项推进顺畅；数据、材料、方案准确清晰，交付结果可直接使用。
- **良好：** 重点工作和临时事项基本按要求完成；交付物整体可用，偶有细节需要修改，但不影响结果。
- **待提升：** 工作推进不够主动或存在延误；数据、材料、方案质量不稳定，需要负责人提醒或返工。
- **不达标：** 重点工作明显漏项或延误；交付物错误较多或无法使用，并已影响项目、流程或管理结果。

**主动推进与复杂事项处理评分说明：**

- **优秀：** 能主动发现问题并提出解决方案；推动事项闭环；复杂问题能协调相关方推进，并形成复盘改进。
- **良好：** 能根据安排推动事项；常规问题能闭环；复杂事项处理基本到位，偶有反馈或复盘不够及时。
- **待提升：** 多数事项需要负责人提醒；问题闭环不够持续；复杂事项协调力度不足，复盘改进停留在表面。
- **不达标：** 对问题缺少主动发现和推进；事项长期无闭环；复杂问题处理不当或未及时反馈，影响工作推进。

## 六、工作失误扣减与奖励超额贡献

### 1. 工作失误扣减

| 情形 | 扣减分值 |
|---|---:|
| 一般工作失误，未造成明显影响 | 3 分 |
| 工作延误、数据错误、流程遗漏，造成一定影响 | 5 分 |
| 被业务部门投诉且核实属实 | 10 分 |
| 违反公司制度或造成较大风险 | 10 分以上 |

### 2. 奖励超额贡献

| 奖励情形 | 分值梯队 | 关键词 |
|---|---:|---|
| 重点项目或额外任务贡献 | 5-10分 | 项目、专项、临时任务 |
| 重大问题解决或风险化解 | 10-20分 | 风险、冲突、稳定性 |
| 流程优化或管理改善 | 10-15分 | 流程、工具、机制 |`;

interface MarkdownTable {
  headers: string[];
  rows: string[][];
}

function getSectionAfter(markdown: string, marker: string) {
  const markerIndex = markdown.indexOf(marker);
  if (markerIndex < 0) return '';
  const afterMarker = markdown.slice(markerIndex + marker.length);
  const nextHeadingIndex = afterMarker.search(/\n#{1,3}\s/);
  return nextHeadingIndex < 0 ? afterMarker : afterMarker.slice(0, nextHeadingIndex);
}

function getTableAfter(markdown: string, marker: string): MarkdownTable {
  const section = getSectionAfter(markdown, marker);
  const lines = section.split('\n');
  const tableLines: string[] = [];
  let tableStarted = false;
  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      tableStarted = true;
      tableLines.push(line);
      continue;
    }
    if (tableStarted) break;
  }
  const parseLine = (line: string) => line.split('|').slice(1, -1).map((cell) => cell.trim());
  const headers = parseLine(tableLines[0] ?? '');
  const rows = tableLines.slice(2).map(parseLine).filter((row) => row.length === headers.length);
  return { headers, rows };
}

function findFormulaWeight(markdown: string, metric: string, fallback: number) {
  const escapedMetric = metric.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`${escapedMetric}\\s*[×x*]\\s*(\\d+(?:\\.\\d+)?)%`));
  return match ? Number(match[1]) : fallback;
}

function normalizeGradeName(value: string) {
  return value.replace(/[：:]/g, '').trim();
}

function getScoringExplanations(markdown: string, sectionMarker: string, explanationLabel: string) {
  const section = getSectionAfter(markdown, sectionMarker);
  const labelIndex = section.indexOf(explanationLabel);
  if (labelIndex < 0) return new Map<string, string>();

  const explanations = new Map<string, string>();
  let foundExplanation = false;
  for (const line of section.slice(labelIndex + explanationLabel.length).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith('-')) {
      if (foundExplanation) break;
      continue;
    }
    foundExplanation = true;
    const match = trimmed.match(/^-\s+\*\*([^*]+)\*\*(?:\s*[：:]\s*)?(.*)$/);
    if (!match) continue;
    const gradeName = normalizeGradeName(match[1] ?? '');
    const explanation = (match[2] ?? '').trim();
    if (gradeName && explanation) explanations.set(gradeName, explanation);
  }
  return explanations;
}

function scoreStandards(table: MarkdownTable, explanations = new Map<string, string>()) {
  return table.rows.map(([score = '', judgement = '', keywords = '']) => {
    const explanation = explanations.get(normalizeGradeName(judgement));
    return [
      `${score} ${judgement}`.trim(),
      keywords ? `关键词：${keywords}` : '',
      explanation ? `评分说明：${explanation}` : '',
    ].filter(Boolean).join('；');
  });
}

export function reorderPerformanceModules(
  modules: PerformanceTemplateModule[],
  sourceModuleId: string,
  targetModuleId: string,
) {
  const sourceIndex = modules.findIndex((module) => module.id === sourceModuleId);
  const targetIndex = modules.findIndex((module) => module.id === targetModuleId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return modules;

  const next = [...modules];
  const [sourceModule] = next.splice(sourceIndex, 1);
  if (!sourceModule) return modules;
  const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  next.splice(insertIndex, 0, sourceModule);
  return next;
}

/**
 * This parser turns the stable Markdown heading and table conventions used by
 * the performance template into module, weight, and indicator records. Its
 * output remains editable in the template workbench before a template is saved.
 */
export function parseHrbpPerformanceMarkdown(markdown: string): ParsedPerformanceTemplate {
  const businessRules = getTableAfter(markdown, '### 1. 计分规则');
  const businessConditions = getTableAfter(markdown, '### 2. 特殊口径');
  const businessOwnerDimensions = getTableAfter(markdown, '### 1. 评价结构');
  const hiringStandards = getTableAfter(markdown, '### 2. 招聘与团队管理支持');
  const supportStandards = getTableAfter(markdown, '### 3. 业务支持与问题闭环');
  const bpDimensions = getTableAfter(markdown, '### 2. 评价内容颗粒度');
  const bpStandards = getTableAfter(markdown, '### 3. 评分档位');
  const deductionRules = getTableAfter(markdown, '### 1. 工作失误扣减');
  const rewardRules = getTableAfter(markdown, '### 2. 奖励超额贡献');
  const hiringExplanations = getScoringExplanations(markdown, '### 2. 招聘与团队管理支持', '评分说明');
  const supportExplanations = getScoringExplanations(markdown, '### 3. 业务支持与问题闭环', '评分说明');
  const deliveryExplanations = getScoringExplanations(markdown, '### 3. 评分档位', '工作交付质量评分说明');
  const initiativeExplanations = getScoringExplanations(markdown, '### 3. 评分档位', '主动推进与复杂事项处理评分说明');

  const businessOwnerIndicators = businessOwnerDimensions.rows.map(([name = '', weight = '']) => ({
    id: `business-owner-${name}`,
    name,
    description: name === '招聘与团队管理支持'
      ? '围绕招聘需求、候选人质量、员工沟通和团队稳定性进行评价。'
      : '围绕业务需求理解、响应效率、协同处理和问题闭环进行评价。',
    standards: name === '招聘与团队管理支持'
      ? scoreStandards(hiringStandards, hiringExplanations)
      : scoreStandards(supportStandards, supportExplanations),
    weightLabel: weight,
    source: '业务负责人评价 / 评价结构及评分说明',
  }));

  return {
    id: 'hrbp-performance-v3',
    name: 'HRBP 月度绩效模板 V3',
    sourceName: 'HRBP分工及绩效V1.md',
    sourceMarkdown: markdown,
    modules: [
      {
        id: businessModuleId,
        name: '业务达成',
        type: 'metric',
        responsibleRole: '系统自动计算',
        executor: { type: 'AUTO' },
        enabled: true,
        participatesInTotal: true,
        weight: findFormulaWeight(markdown, '业务达成评分', 10),
        description: '读取业务目标值、实际值和指标权重，按模板规则自动计算模块得分。',
        indicators: [
          {
            id: 'business-completion-rate',
            name: '业务完成率',
            description: businessConditions.rows.find(([condition]) => condition === '各业务端口')?.[1] ?? '与部门一号位考核保持一致。',
            standards: [
              ...businessRules.rows.map(([condition, rule]) => `${condition}：${rule}`),
              businessConditions.rows.find(([condition]) => condition === '完成率低于 50%')?.join('：') ?? '',
            ].filter(Boolean),
            weightLabel: '100%',
            source: '业务达成 / 计分规则、特殊口径',
          },
        ],
      },
      {
        id: businessOwnerModuleId,
        name: '业务负责人评价',
        type: 'evaluation',
        responsibleRole: '业务负责人',
        executor: { type: 'USER' },
        enabled: true,
        participatesInTotal: true,
        weight: findFormulaWeight(markdown, '业务负责人评价分', 40),
        description: '业务负责人对 BP 的招聘团队支持及业务问题闭环进行综合评价。',
        indicators: businessOwnerIndicators,
      },
      {
        id: bpOwnerModuleId,
        name: 'BP负责人评价',
        type: 'evaluation',
        responsibleRole: 'BP负责人',
        executor: { type: 'USER' },
        enabled: true,
        participatesInTotal: true,
        weight: findFormulaWeight(markdown, 'BP负责人评价分', 50),
        description: 'BP 负责人结合工作交付和复杂事项处理进行综合评分。',
        indicators: bpDimensions.rows.map(([name = '', description = '']) => ({
          id: `bp-owner-${name}`,
          name,
          description,
          standards: scoreStandards(
            bpStandards,
            name === '工作交付质量' ? deliveryExplanations : initiativeExplanations,
          ),
          weightLabel: '综合参考，不单独计权',
          source: 'BP负责人评价 / 评价内容颗粒度、评分档位',
        })),
      },
      {
        id: deductionModuleId,
        name: '工作失误扣减',
        type: 'adjustment',
        responsibleRole: 'BP负责人',
        executor: { type: 'USER' },
        enabled: true,
        participatesInTotal: false,
        weight: null,
        adjustmentDirection: 'DEDUCT',
        adjustmentMin: 0,
        adjustmentMax: 100,
        description: '有明确事实依据时，在固定权重得分之外直接扣减分数。',
        indicators: deductionRules.rows.map(([name = '', score = '']) => ({
          id: `deduction-${name}`,
          name,
          description: '同一事项原则上不重复扣减，重大事项可按公司制度另行处理。',
          standards: [`扣减分值：${score}`],
          weightLabel: '额外扣减',
          source: '工作失误扣减 / 扣减分值',
        })),
      },
      {
        id: rewardModuleId,
        name: '奖励超额贡献',
        type: 'adjustment',
        responsibleRole: 'BP负责人',
        executor: { type: 'USER' },
        enabled: true,
        participatesInTotal: false,
        weight: null,
        adjustmentDirection: 'ADD',
        adjustmentMin: 0,
        adjustmentMax: 20,
        description: '常规职责外的额外价值单独加分，原则上每月最高 20 分。',
        indicators: rewardRules.rows.map(([name = '', score = '', keyword = '']) => ({
          id: `reward-${name}`,
          name,
          description: keyword,
          standards: [`分值梯队：${score}`, '需有明确事实依据，同一事项原则上不重复加分。'],
          weightLabel: '额外加分',
          source: '奖励超额贡献 / 分值梯队',
        })),
      },
    ],
  };
}

export const parsedHrbpPerformanceTemplate = parseHrbpPerformanceMarkdown(hrbpPerformanceV3Markdown);

export function getFixedWeightTotal(modules: PerformanceTemplateModule[]) {
  return modules.reduce(
    (total, module) => total + (module.enabled && module.participatesInTotal ? module.weight ?? 0 : 0),
    0,
  );
}
