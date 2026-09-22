import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  PerformanceIndicatorDefinition,
  PerformanceModuleDefinition,
  PerformanceParseError,
  PerformanceParseWarning,
  PerformanceRuleNode,
  PerformanceTemplateDefinition,
  PerformanceTemplateParseResult,
  PerformanceWorkflowManualStepDefinition,
} from '@hr-demo/shared';

// Only explicitly marked JSON blocks (or a bare fence whose content starts
// with an object) are executable template definitions. Other Markdown code
// examples must not be misclassified as invalid template JSON.
const TEMPLATE_JSON_BLOCK = /```performance-template[ \t]*\r?\n([\s\S]*?)```/i;
const GENERIC_JSON_BLOCK = /```json[ \t]*\r?\n([\s\S]*?)```/i;
const BARE_JSON_BLOCK = /```[ \t]*\r?\n\s*(\{[\s\S]*?\})\s*```/;
const MODULE_TYPES = new Set(['METRIC', 'EVALUATION', 'ADJUSTMENT']);
const EXECUTOR_TYPES = new Set(['AUTO', 'USER', 'DIRECTORY']);
const EXECUTION_MODES = new Set(['SINGLE', 'MULTIPLE']);
const DIRECTORY_TYPES = new Set(['POSITION', 'JOB_TITLE']);
const RULE_OPERATORS = new Set(['constant', 'field', 'add', 'subtract', 'multiply', 'divide', 'min', 'max', 'if']);
const CONDITION_OPERATORS = new Set(['<', '<=', '>', '>=', '=', '!=']);
const RULE_FIELD_NAME = /^[A-Za-z][A-Za-z0-9_.]{0,127}$/;
const WORKFLOW_STEP_TYPES = new Set(['REVIEW', 'CONFIRMATION', 'APPROVAL', 'HR_ARCHIVE']);
const WORKFLOW_REJECTION_STRATEGIES = new Set(['END', 'RETURN_PREVIOUS', 'RETURN_TO_STEP']);

interface MarkdownTable {
  start: number;
  end: number;
  header: string[];
  rows: string[][];
}

interface MarkdownHeading {
  level: number;
  title: string;
  normalizedTitle: string;
  start: number;
  end: number;
}

@Injectable()
export class PerformanceTemplateParser {
  parse(sourceMarkdown: string, sourceName: string | null = null): PerformanceTemplateParseResult {
    const errors: PerformanceParseError[] = [];
    const warnings: PerformanceParseWarning[] = [];
    if (!sourceMarkdown.trim()) {
      return { sourceName, sourceMarkdown, definition: null, errors: [{ path: 'sourceMarkdown', message: 'Markdown 内容不能为空' }], warnings };
    }

    const trimmedSource = sourceMarkdown.trim();
    const templateBlock = sourceMarkdown.match(TEMPLATE_JSON_BLOCK);
    const genericJsonBlock = sourceMarkdown.match(GENERIC_JSON_BLOCK) ?? sourceMarkdown.match(BARE_JSON_BLOCK);
    const blockSource = templateBlock?.[1] ?? genericJsonBlock?.[1] ?? (trimmedSource.startsWith('{') ? trimmedSource : null);
    if (!blockSource) return this.parseMarkdownFallback(sourceMarkdown, sourceName, errors, warnings);

    let value: unknown;
    try {
      value = JSON.parse(blockSource.trim());
    } catch {
      // `performance-template` is an explicit executable definition. A generic
      // JSON example embedded in a Markdown document is not; preserve normal
      // heading/table parsing rather than treating it as a fatal template error.
      if (!templateBlock && !trimmedSource.startsWith('{')) return this.parseMarkdownFallback(sourceMarkdown, sourceName, errors, warnings);
      errors.push({ path: 'definition', message: 'performance-template JSON 格式无效' });
      return { sourceName, sourceMarkdown, definition: null, errors, warnings };
    }

    const definition = this.validateDefinition(value, errors);
    if (!definition && !templateBlock && !trimmedSource.startsWith('{')) {
      errors.splice(0, errors.length);
      return this.parseMarkdownFallback(sourceMarkdown, sourceName, errors, warnings);
    }
    return { sourceName, sourceMarkdown, definition, errors, warnings };
  }

  private parseMarkdownFallback(sourceMarkdown: string, sourceName: string | null, errors: PerformanceParseError[], warnings: PerformanceParseWarning[]) {
    const overviewDefinition = this.parseModuleOverviewMarkdown(sourceMarkdown, warnings);
    if (overviewDefinition) return { sourceName, sourceMarkdown, definition: overviewDefinition, errors, warnings };
    const fieldListDefinition = this.parseFieldListMarkdown(sourceMarkdown, warnings);
    if (fieldListDefinition) return { sourceName, sourceMarkdown, definition: fieldListDefinition, errors, warnings };
    const legacyDefinition = this.parseMarkdownDocument(sourceMarkdown, warnings);
    if (legacyDefinition) return { sourceName, sourceMarkdown, definition: legacyDefinition, errors, warnings };
    errors.push({ path: 'definition', message: '未识别到可解析的 Markdown 模块/指标结构' });
    return { sourceName, sourceMarkdown, definition: null, errors, warnings };
  }

  validateDefinition(value: unknown, errors: PerformanceParseError[] = [], requireExecutorDetails = false): PerformanceTemplateDefinition | null {
    if (!this.isRecord(value)) {
      errors.push({ path: 'definition', message: '模板定义必须是 JSON 对象' });
      return null;
    }
    if (value.schemaVersion !== 1) errors.push({ path: 'schemaVersion', message: '仅支持 schemaVersion=1' });
    if (!this.isNonEmptyString(value.name)) errors.push({ path: 'name', message: '模板名称不能为空' });
    if (!Array.isArray(value.modules) || value.modules.length === 0) {
      errors.push({ path: 'modules', message: '至少需要一个绩效模块' });
      return null;
    }

    const modules: PerformanceModuleDefinition[] = [];
    const ids = new Set<string>();
    for (const [index, rawModule] of value.modules.entries()) {
      const path = `modules[${index}]`;
      if (!this.isRecord(rawModule)) {
        errors.push({ path, message: '模块必须是对象' });
        continue;
      }
      const module = rawModule as Record<string, unknown>;
      const id = this.stringValue(module.id);
      const name = this.stringValue(module.name);
      if (!id) errors.push({ path: `${path}.id`, message: '模块 ID 不能为空' });
      else if (ids.has(id)) errors.push({ path: `${path}.id`, message: '模块 ID 不能重复' });
      else ids.add(id);
      if (!name) errors.push({ path: `${path}.name`, message: '模块名称不能为空' });
      const type = this.stringValue(module.type);
      if (!type || !MODULE_TYPES.has(type)) errors.push({ path: `${path}.type`, message: '模块类型无效' });
      const enabled = module.enabled === true;
      if (typeof module.enabled !== 'boolean') errors.push({ path: `${path}.enabled`, message: 'enabled 必须为布尔值' });
      const participatesInTotal = module.participatesInTotal === true;
      const weight = module.weight === null ? null : this.numberValue(module.weight);
      if (participatesInTotal && (weight === null || weight < 0 || weight > 100)) errors.push({ path: `${path}.weight`, message: '计入总分的模块权重必须为 0-100 的数字' });
      if (!participatesInTotal && weight !== null) errors.push({ path: `${path}.weight`, message: '不计入总分的模块权重必须为 null' });
      const executor = this.validateExecutor(module.executor, `${path}.executor`, errors, requireExecutorDetails);
      const indicators = this.validateIndicators(module.indicators, `${path}.indicators`, errors);
      if (type !== 'METRIC' && indicators.some((indicator) => indicator.rule)) errors.push({ path: `${path}.indicators`, message: '声明式评分规则只能配置在业务指标模块' });
      if (type === 'METRIC' && executor?.type !== 'AUTO') errors.push({ path: `${path}.executor`, message: '业务指标模块只能使用 AUTO 执行人' });
      if ((type === 'EVALUATION' || type === 'ADJUSTMENT') && executor?.type === 'AUTO') errors.push({ path: `${path}.executor`, message: '人工评估和调整模块不能使用 AUTO 执行人' });
      if (type === 'METRIC') {
        if (indicators.length === 0) errors.push({ path: `${path}.indicators`, message: '业务指标模块至少需要一个指标' });
        const total = indicators.reduce((sum, indicator) => sum + indicator.weight, 0);
        if (Math.abs(total - 100) > 0.0001) errors.push({ path: `${path}.indicators`, message: `业务指标权重合计必须为 100%，当前为 ${total}%` });
      }
      if (type === 'ADJUSTMENT') {
        if (participatesInTotal || weight !== null) errors.push({ path, message: '调整模块只能作为固定权重得分后的额外加减分，不能参与固定权重' });
        const direction = this.stringValue(module.adjustmentDirection);
        if (direction !== 'ADD' && direction !== 'DEDUCT') errors.push({ path: `${path}.adjustmentDirection`, message: '调整方向必须为 ADD 或 DEDUCT' });
        const min = this.numberValue(module.adjustmentMin);
        const max = this.numberValue(module.adjustmentMax);
        if (min === null || max === null || min < 0 || max < min) errors.push({ path, message: '调整项必须定义有效的非负上下限' });
      }
      if (id && name && type && MODULE_TYPES.has(type) && executor) {
        modules.push({
          id,
          name,
          type: type as PerformanceModuleDefinition['type'],
          enabled,
          participatesInTotal,
          weight,
          description: this.stringValue(module.description) ?? '',
          executor,
          indicators,
          adjustmentDirection: this.stringValue(module.adjustmentDirection) as PerformanceModuleDefinition['adjustmentDirection'],
          adjustmentMin: this.numberValue(module.adjustmentMin) ?? undefined,
          adjustmentMax: this.numberValue(module.adjustmentMax) ?? undefined,
          optional: module.optional === true || (type === 'ADJUSTMENT' && /工作失误|超额奖励|超额贡献/.test(name)),
          requireComment: module.requireComment === true,
          requireAttachment: module.requireAttachment === true,
        });
      }
    }

    const fixedWeight = modules.filter((module) => module.enabled && module.participatesInTotal).reduce((sum, module) => sum + (module.weight ?? 0), 0);
    if (Math.abs(fixedWeight - 100) > 0.0001) errors.push({ path: 'modules', message: `启用的固定权重模块合计必须为 100%，当前为 ${fixedWeight}%` });
    const manualSteps = this.validateWorkflow(value.workflow, 'workflow', errors, requireExecutorDetails);
    return errors.length === 0
      ? {
          schemaVersion: 1,
          name: value.name as string,
          description: this.stringValue(value.description) ?? undefined,
          modules,
          workflow: { manualSteps },
        }
      : null;
  }

  assertValidDefinition(value: unknown, requireExecutorDetails = false) {
    const errors: PerformanceParseError[] = [];
    const definition = this.validateDefinition(value, errors, requireExecutorDetails);
    if (!definition) throw new BadRequestException(errors.map((error) => `${error.path}: ${error.message}`));
    return definition;
  }

  private validateWorkflow(
    value: unknown,
    path: string,
    errors: PerformanceParseError[],
    requireExecutorDetails: boolean,
  ): PerformanceWorkflowManualStepDefinition[] {
    if (value === undefined || value === null) return [];
    if (!this.isRecord(value)) {
      errors.push({ path, message: '流程定义必须是对象' });
      return [];
    }
    if (!Array.isArray(value.manualSteps)) {
      errors.push({ path: `${path}.manualSteps`, message: '手动流程步骤必须是数组' });
      return [];
    }

    const steps: PerformanceWorkflowManualStepDefinition[] = [];
    const ids = new Set<string>();
    for (const [index, rawStep] of value.manualSteps.entries()) {
      const stepPath = `${path}.manualSteps[${index}]`;
      if (!this.isRecord(rawStep)) {
        errors.push({ path: stepPath, message: '手动流程步骤必须是对象' });
        continue;
      }
      const id = this.stringValue(rawStep.id);
      const name = this.stringValue(rawStep.name);
      const type = this.stringValue(rawStep.type);
      if (!id) errors.push({ path: `${stepPath}.id`, message: '流程步骤 ID 不能为空' });
      else if (ids.has(id)) errors.push({ path: `${stepPath}.id`, message: '流程步骤 ID 不能重复' });
      else ids.add(id);
      if (!name) errors.push({ path: `${stepPath}.name`, message: '流程步骤名称不能为空' });
      if (!type || !WORKFLOW_STEP_TYPES.has(type)) {
        errors.push({ path: `${stepPath}.type`, message: '流程只能新增审核、本人确认、审批或 HR 归档步骤' });
        continue;
      }
      const executor = this.validateExecutor(rawStep.executor, `${stepPath}.executor`, errors, requireExecutorDetails);
      if (executor?.type === 'AUTO') errors.push({ path: `${stepPath}.executor`, message: '手动流程步骤不能使用 AUTO 执行人' });

      const rawStrategy = this.stringValue(rawStep.rejectionStrategy);
      const hasRejection = type === 'REVIEW' || type === 'APPROVAL';
      const rejectionStrategy = rawStrategy ?? (hasRejection ? 'END' : undefined);
      if (rawStrategy && !WORKFLOW_REJECTION_STRATEGIES.has(rawStrategy)) {
        errors.push({ path: `${stepPath}.rejectionStrategy`, message: '驳回策略无效' });
      }
      if (!hasRejection && (rawStep.rejectionStrategy !== undefined || rawStep.rejectionTargetStepId !== undefined)) {
        errors.push({ path: stepPath, message: '只有审核和审批步骤可以配置驳回策略' });
      }
      if (rejectionStrategy === 'RETURN_TO_STEP' && !this.isNonEmptyString(rawStep.rejectionTargetStepId)) {
        errors.push({ path: `${stepPath}.rejectionTargetStepId`, message: '退回指定步骤时必须选择前序手动步骤' });
      }
      if (rejectionStrategy !== 'RETURN_TO_STEP' && rawStep.rejectionTargetStepId !== undefined) {
        errors.push({ path: `${stepPath}.rejectionTargetStepId`, message: '只有退回指定步骤时可以配置退回目标' });
      }
      if (id && name && type && WORKFLOW_STEP_TYPES.has(type) && executor) {
        steps.push({
          id,
          name,
          type: type as PerformanceWorkflowManualStepDefinition['type'],
          executor,
          ...(hasRejection ? { rejectionStrategy: rejectionStrategy as PerformanceWorkflowManualStepDefinition['rejectionStrategy'] } : {}),
          ...(rejectionStrategy === 'RETURN_TO_STEP' ? { rejectionTargetStepId: this.stringValue(rawStep.rejectionTargetStepId) ?? undefined } : {}),
        });
      }
    }

    const stepIds = new Set(steps.map((step) => step.id));
    steps.forEach((step, index) => {
      if (step.rejectionStrategy === 'RETURN_PREVIOUS' && index === 0) {
        errors.push({ path: `${path}.manualSteps[${index}].rejectionStrategy`, message: '第一个手动流程步骤不能退回上一步' });
      }
      if (step.rejectionStrategy === 'RETURN_TO_STEP') {
        const targetIndex = steps.findIndex((candidate) => candidate.id === step.rejectionTargetStepId);
        if (!step.rejectionTargetStepId || !stepIds.has(step.rejectionTargetStepId) || targetIndex < 0 || targetIndex >= index) {
          errors.push({ path: `${path}.manualSteps[${index}].rejectionTargetStepId`, message: '只能退回到当前步骤之前的手动流程步骤' });
        }
      }
    });
    return steps;
  }

  private validateExecutor(value: unknown, path: string, errors: PerformanceParseError[], requireDetails: boolean) {
    if (!this.isRecord(value) || !EXECUTOR_TYPES.has(String(value.type))) {
      errors.push({ path, message: '执行人配置必须为 AUTO、USER 或 DIRECTORY' });
      return null;
    }
    const type = String(value.type) as 'AUTO' | 'USER' | 'DIRECTORY';
    const rawExecutionMode = this.stringValue(value.executionMode) ?? 'SINGLE';
    if (!EXECUTION_MODES.has(rawExecutionMode)) {
      errors.push({ path: `${path}.executionMode`, message: '执行方式必须为 SINGLE 或 MULTIPLE' });
    }
    const executionMode = rawExecutionMode as 'SINGLE' | 'MULTIPLE';
    if (type === 'AUTO') {
      if (executionMode !== 'SINGLE') errors.push({ path: `${path}.executionMode`, message: '系统自动计算只能单人执行' });
      return { type, executionMode } as const;
    }
    if (type === 'USER') {
      const employeeIds = Array.isArray(value.employeeIds)
        ? value.employeeIds.filter((item): item is string => this.isNonEmptyString(item)).map((item) => item.trim())
        : [];
      const rawEmployeeSnapshots = Array.isArray(value.employeeSnapshots) ? value.employeeSnapshots : [];
      const seenSnapshotEmployeeIds = new Set<string>();
      const employeeSnapshots = rawEmployeeSnapshots.flatMap((snapshot) => {
        if (!this.isRecord(snapshot)) return [];
        const employeeId = this.stringValue(snapshot.employeeId);
        if (!employeeId || !employeeIds.includes(employeeId) || seenSnapshotEmployeeIds.has(employeeId)) return [];
        seenSnapshotEmployeeIds.add(employeeId);
        return [{
          employeeId,
          name: this.stringValue(snapshot.name) ?? '--',
          employeeNo: this.stringValue(snapshot.employeeNo) ?? '--',
          organizationId: this.stringValue(snapshot.organizationId) ?? null,
          organizationName: this.stringValue(snapshot.organizationName) ?? null,
        }];
      });
      const snapshotsByEmployeeId = new Map(employeeSnapshots.map((snapshot) => [snapshot.employeeId, snapshot]));
      const normalizedSnapshots = [...new Set(employeeIds)].flatMap((employeeId) => snapshotsByEmployeeId.get(employeeId) ? [snapshotsByEmployeeId.get(employeeId)!] : []);
      const legacyUserIds = Array.isArray(value.userIds)
        ? value.userIds.filter((item): item is string => this.isNonEmptyString(item)).map((item) => item.trim())
        : this.isNonEmptyString(value.userId) ? [value.userId.trim()] : [];
      const selectedIds = employeeIds.length > 0 ? employeeIds : legacyUserIds;
      const uniqueSelectedIds = [...new Set(selectedIds)];
      if (selectedIds.length !== uniqueSelectedIds.length) errors.push({ path: `${path}.${employeeIds.length > 0 ? 'employeeIds' : 'userIds'}`, message: '具体执行人员不能重复选择' });
      if (requireDetails && uniqueSelectedIds.length === 0) errors.push({ path: `${path}.employeeIds`, message: '具体执行人员必须至少指定一人' });
      if (executionMode === 'SINGLE' && uniqueSelectedIds.length > 1) errors.push({ path: `${path}.employeeIds`, message: '单人执行只能指定一名具体执行人员' });
      if (executionMode === 'MULTIPLE' && uniqueSelectedIds.length < 2) errors.push({ path: `${path}.employeeIds`, message: '多人执行必须指定至少两名具体执行人员' });
      return employeeIds.length > 0
        ? { type, executionMode, employeeIds: uniqueSelectedIds, ...(normalizedSnapshots.length ? { employeeSnapshots: normalizedSnapshots.filter((snapshot) => uniqueSelectedIds.includes(snapshot.employeeId)) } : {}) }
        : { type, executionMode, userIds: uniqueSelectedIds };
    }
    const directoryType = this.stringValue(value.directoryType);
    if (executionMode !== 'SINGLE') errors.push({ path: `${path}.executionMode`, message: '岗位或职务执行人只能单人执行' });
    if (requireDetails && (!directoryType || !DIRECTORY_TYPES.has(directoryType) || !this.isNonEmptyString(value.directoryId))) {
      errors.push({ path, message: '岗位执行人必须指定 directoryType 和 directoryId' });
    }
    return {
      type,
      executionMode,
      directoryType: directoryType as 'POSITION' | 'JOB_TITLE',
      directoryId: this.stringValue(value.directoryId) ?? undefined,
    };
  }

  private parseMarkdownDocument(markdown: string, warnings: PerformanceParseWarning[]): PerformanceTemplateDefinition | null {
    // Formatting tags such as <br> are common in exported Markdown tables.
    // Treat them as inert document text; only executable HTML blocks remain
    // invalid input for the structured parser.
    if (/<\/?(?:script|style)\b/i.test(markdown)) return null;
    const normalizedMarkdown = markdown
      .replace(/<br\s*\/?>/gi, '；')
      .replace(/<\/?[A-Za-z][^>]*>/g, '');
    const lines = normalizedMarkdown.split(/\r?\n/);
    const lineOf = (needle: string) => Math.max(1, lines.findIndex((line) => line.includes(needle)) + 1);
    const hasSecondLevelHeadings = lines.some((line) => /^##\s+/.test(line));
    const tableCells = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.includes('|')) return [];
      const cells = trimmed.split('|');
      if (trimmed.startsWith('|')) cells.shift();
      if (trimmed.endsWith('|')) cells.pop();
      return cells.map((cell) => cell.trim());
    };
    const overviewRows = lines
      .map(tableCells)
      .filter((row) => row.length >= 2 && row.some(Boolean));
    const overviewHeaderIndex = overviewRows.findIndex((row) => row.some((cell) => /目标维度|指标名称|考核指标|绩效指标|考评项|指标|事项|项目|内容/.test(cell))
      && row.some((cell) => /权重|占比|比例/.test(cell)));
    if (overviewHeaderIndex >= 0) {
      const overviewModules = new Map<string, PerformanceModuleDefinition>();
      const header = overviewRows[overviewHeaderIndex] ?? [];
      const categoryIndex = header.findIndex((cell) => /目标分类|考核模块|考核环节|模块名称|类别|维度|模块/.test(cell));
      const indicatorIndex = header.findIndex((cell) => /目标维度|指标名称|考核指标|绩效指标|考评项|指标|事项|项目|内容/.test(cell) && !/模块/.test(cell));
      const weightIndex = header.findIndex((cell) => /权重|占比|比例/.test(cell));
      const descriptionIndex = header.findIndex((cell) => /关键事项|行动计划|指标描述|说明|内容/.test(cell));
      for (const [index, row] of overviewRows.slice(overviewHeaderIndex + 1).entries()) {
        if (row.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))) continue;
        const rawCategory = categoryIndex >= 0 ? row[categoryIndex] ?? '' : '';
        const category = rawCategory.replace(/（[^）]*）|\([^)]*\)/g, '').trim() || this.nearestHeadingBefore(lines, this.tableHeaderLine(lines, overviewHeaderIndex)) || '未分组模块';
        const indicatorName = row[indicatorIndex >= 0 ? indicatorIndex : 0]?.trim();
        const weightMatch = row[weightIndex >= 0 ? weightIndex : 1]?.match(/(\d+(?:\.\d+)?)\s*%/);
        if (!indicatorName || !weightMatch) continue;
        const weight = Number(weightMatch[1]);
        const moduleId = `markdown-${overviewModules.size + 1}`;
        const existing = overviewModules.get(category);
        const module = existing ?? {
          id: moduleId,
          name: category,
          // Natural-language category names never determine execution mode.
          type: 'EVALUATION' as const,
          enabled: true,
          participatesInTotal: true,
          weight: 0,
          description: '',
          executor: { type: 'USER' as const, executionMode: 'SINGLE' as const, userIds: [] },
          indicators: [],
        };
        module.weight = (module.weight ?? 0) + weight;
        module.indicators.push({ id: `markdown-indicator-${module.id}-${index + 1}`, name: indicatorName, description: descriptionIndex >= 0 ? row[descriptionIndex] ?? '' : '', standards: [], weight });
        overviewModules.set(category, module);
        warnings.push({ path: `modules.${module.id}.type`, sourceLine: lineOf(rawCategory), message: `“${category}”的模块类型需要在编辑器中确认；未根据名称自动推断为业务指标或人工评估。` });
      }
      const modules = [...overviewModules.values()];
      for (const module of modules) this.enrichMarkdownModule(module, lines, warnings);
      if (modules.length > 0) return this.finalizeMarkdownDefinition(markdown, modules, warnings);
    }
    const modules: PerformanceModuleDefinition[] = [];
    let currentModule: PerformanceModuleDefinition | null = null;
    let currentIndicator: PerformanceModuleDefinition['indicators'][number] | null = null;
    let indicatorSection: 'description' | 'standards' | null = null;
    const flushIndicator = () => {
      if (currentModule && currentIndicator) currentModule.indicators.push(currentIndicator);
      currentIndicator = null;
      indicatorSection = null;
    };
    const flushModule = () => {
      flushIndicator();
      if (currentModule) modules.push(currentModule);
      currentModule = null;
    };
    const percent = (value: string) => {
      const match = value.match(/(\d+(?:\.\d+)?)\s*%/);
      return match ? Number(match[1]) : null;
    };
    const cleanHeading = (value: string) => value
      .replace(/^第?[一二三四五六七八九十百]+[、.]\s*/, '')
      .replace(/^\d+[、.]\s*/, '')
      .trim();
    const cleanModuleHeading = (value: string) => cleanHeading(value)
      .replace(/\s*模块权重\s*[:：]?\s*\d+(?:\.\d+)?\s*%?\s*$/i, '')
      .trim();
    const createModule = (rawName: string) => {
      const name = cleanModuleHeading(rawName);
      const adjustment = /加分项|减分项|调整项|扣减|奖励/.test(name);
      return {
        id: `legacy-${modules.length + 1}`,
        name,
        type: 'EVALUATION' as const,
        enabled: true,
        participatesInTotal: !adjustment,
        weight: adjustment ? null : percent(rawName),
        description: '',
        executor: { type: 'USER' as const, executionMode: 'SINGLE' as const, userIds: [] },
        indicators: [],
        ...(adjustment ? { adjustmentDirection: /减分项|扣减/.test(name) ? 'DEDUCT' as const : 'ADD' as const, adjustmentMin: 0, adjustmentMax: 100, optional: /工作失误|超额奖励|超额贡献/.test(name) } : {}),
      } satisfies PerformanceModuleDefinition;
    };
    const startIndicator = (rawName: string) => {
      flushIndicator();
      currentIndicator = {
        id: `legacy-indicator-${currentModule?.id ?? 'unknown'}-${(currentModule?.indicators.length ?? 0) + 1}`,
        name: cleanHeading(rawName).replace(/[（(]\s*权重\s*[:：]?\s*\d+(?:\.\d+)?\s*%\s*[）)]/, '').trim(),
        description: '',
        standards: [],
        weight: percent(rawName) ?? 0,
      };
    };

    for (const line of lines) {
      const levelOne = line.match(/^#\s+(.+?)\s*$/);
      if (levelOne) {
        // When second-level sections exist, the level-one heading identifies
        // the document. Treating it as a module creates a phantom zero-weight
        // module ahead of every real section.
        if (hasSecondLevelHeadings) continue;
        const rawName = levelOne[1] ?? '';
        flushModule();
        currentModule = createModule(rawName);
        warnings.push({ path: `modules.${currentModule.id}.type`, sourceLine: lineOf(rawName), message: `“${currentModule.name}”的模块类型需要在编辑器中确认；未根据标题自动推断模块类型或调整方向。` });
        continue;
      }

      const levelTwo = line.match(/^##\s+(.+?)\s*$/);
      if (levelTwo) {
        const rawName = levelTwo[1] ?? '';
        if (/使用说明|考核指标总览/.test(rawName)) continue;
        flushModule();
        currentModule = createModule(rawName);
        warnings.push({ path: `modules.${currentModule.id}.type`, sourceLine: lineOf(rawName), message: `“${currentModule.name}”的模块类型需要在编辑器中确认；未根据标题自动推断模块类型或调整方向。` });
        continue;
      }

      const levelThree = line.match(/^###\s+(.+?)\s*$/);
      if (levelThree && currentModule) {
        const rawName = levelThree[1] ?? '';
        if (/模块权重|加分项|减分项|调整项|扣减|奖励/.test(rawName)) {
          flushModule();
          currentModule = createModule(rawName);
          warnings.push({ path: `modules.${currentModule.id}.type`, sourceLine: lineOf(rawName), message: `“${currentModule.name}”的模块类型需要在编辑器中确认；未根据标题自动推断模块类型或调整方向。` });
        } else {
          startIndicator(rawName);
        }
        continue;
      }

      const levelFour = line.match(/^#{4,}\s+(.+?)\s*$/);
      if (levelFour && currentModule) {
        startIndicator(levelFour[1] ?? '');
        continue;
      }

      const weightLine = line.match(/^\s*(?:[-*]\s*)?(?:权重|权重占比|占比)\s*[:：]\s*(\d+(?:\.\d+)?)\s*%?/i);
      if (weightLine) {
        const weight = Number(weightLine[1]);
        const activeIndicator = currentIndicator as PerformanceIndicatorDefinition | null;
        if (activeIndicator) activeIndicator.weight = weight;
        else if (currentModule) currentModule.weight = weight;
        continue;
      }

      const activeIndicator = currentIndicator as PerformanceIndicatorDefinition | null;
      if (activeIndicator) {
        const sectionLine = line.match(/^\s*(?:[-*]\s*)?(指标描述|关键事项(?:\s*\/\s*行动计划)?|衡量标准|评分参考)\s*[:：]?\s*$/);
        if (sectionLine) {
          indicatorSection = /衡量标准|评分参考/.test(sectionLine[1] ?? '') ? 'standards' : 'description';
          continue;
        }
        const content = line.trim().replace(/^\s*(?:[-*]|\d+[.)、])\s*/, '').trim();
        if (content && indicatorSection) {
          if (indicatorSection === 'standards') activeIndicator.standards.push(content);
          else activeIndicator.description = activeIndicator.description ? `${activeIndicator.description}\n${content}` : content;
        }
      }

      const tableRow = line.match(/^\|\s*([^|]+?)\s*\|\s*(\d+(?:\.\d+)?)%\s*\|/);
      if (tableRow && currentModule && !/模块|---/.test(tableRow[1] ?? '')) {
        currentModule.indicators.push({
          id: `legacy-indicator-${currentModule.id}-${currentModule.indicators.length + 1}`,
          name: (tableRow[1] ?? '').trim(),
          description: '',
          standards: [],
          weight: Number(tableRow[2]),
        });
      }
    }
    flushModule();
    if (modules.length === 0) return null;
    return this.finalizeMarkdownDefinition(markdown, modules, warnings);
  }

  /**
   * Extracts a template from a document-level module overview, then fills each
   * module from the matching Markdown section. This format is common in HR
   * documents: the overview owns module order and weights, while later
   * sections own indicators, scoring bands and calculation rules.
   */
  private parseModuleOverviewMarkdown(markdown: string, warnings: PerformanceParseWarning[]): PerformanceTemplateDefinition | null {
    if (/<\/?(?:script|style)\b/i.test(markdown)) return null;
    const lines = markdown
      .replace(/<br\s*\/?>/gi, '；')
      .replace(/<\/?[A-Za-z][^>]*>/g, '')
      .split(/\r?\n/);
    const tables = this.collectMarkdownTables(lines);
    const overview = tables.find((table) => {
      const moduleColumn = this.findMarkdownModuleColumn(table.header);
      const weightColumn = this.findMarkdownWeightColumn(table.header);
      if (moduleColumn < 0 || weightColumn < 0) return false;
      return table.rows.some((row) => {
        const name = this.normalizeMarkdownHeading(row[moduleColumn] ?? '');
        if (!name) return false;
        const type = this.inferMarkdownModuleType(name, row.join(' '));
        return this.extractMarkdownPercent(row[weightColumn] ?? '') !== null || type.type === 'ADJUSTMENT';
      });
    });
    if (!overview) return null;

    const moduleColumn = this.findMarkdownModuleColumn(overview.header);
    const weightColumn = this.findMarkdownWeightColumn(overview.header);
    const indicatorColumn = this.findMarkdownIndicatorColumn(overview.header, moduleColumn);
    const descriptionColumn = overview.header.findIndex((cell, index) => (
      index !== moduleColumn && index !== weightColumn && index !== indicatorColumn
      && /评分口径|评分方式|指标描述|关键事项|行动计划|说明|描述|内容|规则/.test(cell)
    ));
    const modulesByName = new Map<string, PerformanceModuleDefinition>();

    for (const row of overview.rows) {
      const rawName = row[moduleColumn] ?? '';
      const name = this.normalizeMarkdownHeading(rawName);
      if (!name) continue;
      const rawWeight = row[weightColumn] ?? '';
      const inferred = this.inferMarkdownModuleType(name, `${overview.header.join(' ')}\n${row.join(' ')}`);
      const declaredWeight = this.extractMarkdownPercent(rawWeight);
      const adjustment = inferred.type === 'ADJUSTMENT';
      const key = this.comparableMarkdownName(name);
      const description = descriptionColumn >= 0 ? (row[descriptionColumn] ?? '').trim() : '';
      const existing = modulesByName.get(key);
      const module = existing ?? {
        id: `markdown-overview-${modulesByName.size + 1}`,
        name,
        type: inferred.type,
        enabled: true,
        participatesInTotal: !adjustment && declaredWeight !== null,
        weight: adjustment ? null : declaredWeight,
        description,
        executor: inferred.type === 'METRIC'
          ? { type: 'AUTO' as const, executionMode: 'SINGLE' as const }
          : { type: 'USER' as const, executionMode: 'SINGLE' as const, userIds: [] },
        indicators: [],
        ...(adjustment ? {
          adjustmentDirection: inferred.adjustmentDirection,
          adjustmentMin: 0,
          adjustmentMax: 100,
          optional: /工作失误|超额奖励|超额贡献/.test(name),
        } : {}),
      } satisfies PerformanceModuleDefinition;

      if (!existing) modulesByName.set(key, module);
      else {
        if (!adjustment && declaredWeight !== null) module.weight = (module.weight ?? 0) + declaredWeight;
        module.description = this.appendMarkdownText(module.description, description);
      }

      const indicatorName = indicatorColumn >= 0 ? this.normalizeMarkdownHeading(row[indicatorColumn] ?? '') : '';
      if (indicatorName && this.comparableMarkdownName(indicatorName) !== key) {
        const indicatorWeight = adjustment ? 0 : declaredWeight ?? 0;
        const indicator = module.indicators.find((item) => this.comparableMarkdownName(item.name) === this.comparableMarkdownName(indicatorName));
        if (indicator) {
          if (declaredWeight !== null) indicator.weight = indicatorWeight;
          indicator.description = this.appendMarkdownText(indicator.description, description);
        } else {
          module.indicators.push({
            id: `${module.id}-indicator-${module.indicators.length + 1}`,
            name: indicatorName,
            description,
            standards: [],
            weight: indicatorWeight,
          });
        }
      }
    }

    const modules = [...modulesByName.values()];
    if (modules.length === 0) return null;
    const headings = this.collectMarkdownHeadings(lines);
    for (const module of modules) {
      const section = this.findMarkdownModuleSection(module.name, headings);
      const sectionText = section ? lines.slice(section.start, section.end).join('\n') : `${module.name}\n${module.description}`;
      const inferred = this.inferMarkdownModuleType(module.name, sectionText);
      this.applyMarkdownModuleType(module, inferred, sectionText);
      if (!inferred.recognized) {
        warnings.push({
          path: `modules.${module.id}.type`,
          sourceLine: section ? section.start + 1 : overview.start + 1,
          message: `“${module.name}”未根据名称自动推断模块类型，暂按人工评估处理；可在编辑器中调整。`,
        });
      }
      if (section) this.enrichMarkdownOverviewModule(module, section, headings, tables, lines);
      if (module.type === 'METRIC' && module.indicators.length === 0) {
        module.indicators.push({
          id: `${module.id}-indicator-1`,
          name: module.name,
          description: module.description,
          standards: [],
          weight: 100,
        });
      }
    }

    return this.finalizeMarkdownDefinition(markdown, modules, warnings);
  }

  private enrichMarkdownOverviewModule(
    module: PerformanceModuleDefinition,
    section: MarkdownHeading,
    headings: MarkdownHeading[],
    tables: MarkdownTable[],
    lines: string[],
  ) {
    const sectionTables = tables.filter((table) => table.start > section.start && table.end <= section.end);
    for (const table of sectionTables) {
      const indicatorColumn = this.findMarkdownIndicatorColumn(table.header, -1, module.type === 'ADJUSTMENT');
      if (indicatorColumn < 0) continue;
      const weightColumn = this.findMarkdownWeightColumn(table.header);
      const descriptionColumns = table.header.map((_, index) => index).filter((index) => index !== indicatorColumn && index !== weightColumn);
      for (const row of table.rows) {
        const name = this.normalizeMarkdownHeading(row[indicatorColumn] ?? '');
        if (!name) continue;
        const weight = this.extractMarkdownPercent(weightColumn >= 0 ? row[weightColumn] ?? '' : '');
        const description = descriptionColumns.map((index) => row[index]?.trim()).filter(Boolean).join('；');
        const existing = module.indicators.find((indicator) => this.comparableMarkdownName(indicator.name) === this.comparableMarkdownName(name));
        if (existing) {
          if (weight !== null) existing.weight = weight;
          existing.description = this.appendMarkdownText(existing.description, description);
        } else {
          module.indicators.push({
            id: `${module.id}-indicator-${module.indicators.length + 1}`,
            name,
            description,
            standards: [],
            weight: module.type === 'ADJUSTMENT' ? 0 : weight ?? 0,
          });
        }
      }
    }

    const sectionStandards = this.markdownStandardsForRange(lines, section.start + 1, section.end, sectionTables);
    if (module.indicators.length === 0) {
      module.indicators.push({
        id: `${module.id}-indicator-1`,
        name: module.name,
        description: module.description,
        standards: sectionStandards,
        weight: module.type === 'METRIC' ? 100 : 0,
      });
      return;
    }

    for (const indicator of module.indicators) {
      const specificStandards = this.markdownStandardsForIndicator(indicator.name, section, headings, tables, lines);
      const standards = specificStandards.length > 0
        ? specificStandards
        : module.type === 'METRIC' || module.type === 'ADJUSTMENT'
          ? sectionStandards
          : [];
      indicator.standards = this.uniqueMarkdownText([...indicator.standards, ...standards]);
      if (!indicator.description) indicator.description = module.description;
    }
  }

  private inferMarkdownModuleType(name: string, content: string): {
    type: PerformanceModuleDefinition['type'];
    adjustmentDirection?: 'ADD' | 'DEDUCT';
    recognized: boolean;
  } {
    const source = `${name}\n${content}`;
    const explicit = source.match(/(?:模块类型|类型)\s*[:：]\s*(METRIC|EVALUATION|ADJUSTMENT|指标计算|人工评估|结果调整)/i)?.[1]?.toUpperCase();
    if (explicit === 'METRIC' || explicit === '指标计算') return { type: 'METRIC', recognized: true };
    if (explicit === 'EVALUATION' || explicit === '人工评估') return { type: 'EVALUATION', recognized: true };
    if (explicit === 'ADJUSTMENT' || explicit === '结果调整') return { type: 'ADJUSTMENT', adjustmentDirection: /扣减|减分|扣分|惩罚/.test(source) ? 'DEDUCT' : 'ADD', recognized: true };
    if (/加分|奖励|扣减|减分|扣分|惩罚|奖惩|额外调整/.test(name)) {
      return { type: 'ADJUSTMENT', adjustmentDirection: /扣减|减分|扣分|惩罚/.test(name) ? 'DEDUCT' : 'ADD', recognized: true };
    }
    if (/自动计算|系统计算|数据接口|外部数据|数据来源|目标值|实际值|完成率|达成率|系统取数/.test(source)) {
      return { type: 'METRIC', recognized: true };
    }
    if (/评估|评价|自评|评分|审核/.test(source)) return { type: 'EVALUATION', recognized: true };
    if (/加分|奖励|扣减|减分|扣分|惩罚|奖惩|额外调整/.test(source)) {
      return { type: 'ADJUSTMENT', adjustmentDirection: /扣减|减分|扣分|惩罚/.test(source) ? 'DEDUCT' : 'ADD', recognized: true };
    }
    return { type: 'EVALUATION', recognized: false };
  }

  private applyMarkdownModuleType(
    module: PerformanceModuleDefinition,
    inferred: ReturnType<PerformanceTemplateParser['inferMarkdownModuleType']>,
    context: string,
  ) {
    module.type = inferred.type;
    if (inferred.type === 'METRIC') {
      module.executor = { type: 'AUTO', executionMode: 'SINGLE' };
      module.participatesInTotal = module.weight !== null;
      return;
    }
    if (inferred.type === 'EVALUATION') {
      module.executor = { type: 'USER', executionMode: 'SINGLE', userIds: [] };
      module.participatesInTotal = module.weight !== null;
      module.adjustmentDirection = undefined;
      module.adjustmentMin = undefined;
      module.adjustmentMax = undefined;
      return;
    }
    const maximum = context.match(/(?:最高|上限|不超过)\s*\+?\s*(\d+(?:\.\d+)?)\s*分/)?.[1];
    module.weight = null;
    module.participatesInTotal = false;
    module.executor = { type: 'USER', executionMode: 'SINGLE', userIds: [] };
    module.adjustmentDirection = inferred.adjustmentDirection ?? 'ADD';
    module.adjustmentMin = 0;
    module.adjustmentMax = maximum ? Number(maximum) : 100;
  }

  private collectMarkdownTables(lines: string[]): MarkdownTable[] {
    const tables: MarkdownTable[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const header = this.toTableCells(lines[index] ?? '');
      if (header.length < 2) continue;
      const start = index;
      const rows = [header];
      index += 1;
      while (index < lines.length) {
        const cells = this.toTableCells(lines[index] ?? '');
        if (cells.length < 2) break;
        rows.push(cells);
        index += 1;
      }
      const separatorIndex = rows.findIndex((row, rowIndex) => rowIndex > 0 && row.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, ''))));
      const dataStart = separatorIndex >= 0 ? separatorIndex + 1 : 1;
      const dataRows = rows.slice(dataStart).filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, ''))));
      if (dataRows.length > 0) tables.push({ start, end: index, header, rows: dataRows });
      index -= 1;
    }
    return tables;
  }

  private collectMarkdownHeadings(lines: string[]): MarkdownHeading[] {
    const headings = lines.flatMap((line, index) => {
      const match = line.match(/^(#{2,6})\s+(.+?)\s*$/);
      if (!match?.[1] || !match[2]) return [];
      return [{ level: match[1].length, title: match[2], normalizedTitle: this.normalizeMarkdownHeading(match[2]), start: index, end: lines.length }];
    });
    for (const [index, heading] of headings.entries()) {
      const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
      heading.end = next?.start ?? lines.length;
    }
    return headings;
  }

  private findMarkdownModuleSection(moduleName: string, headings: MarkdownHeading[]) {
    const expected = this.comparableMarkdownName(moduleName);
    const matches = headings.filter((heading) => this.comparableMarkdownName(heading.normalizedTitle) === expected);
    if (matches.length > 0) return matches.sort((left, right) => left.level - right.level || left.start - right.start)[0];
    return headings.find((heading) => {
      const candidate = this.comparableMarkdownName(heading.normalizedTitle);
      return candidate.includes(expected) || expected.includes(candidate);
    });
  }

  private findMarkdownModuleColumn(header: string[]) {
    return header.findIndex((cell) => /^(?:考核|绩效)?模块(?:名称)?$|目标分类|目标类别|考核类别|模块类别|考核项|评价项/.test(cell.replace(/\s/g, '')));
  }

  private findMarkdownWeightColumn(header: string[]) {
    return header.findIndex((cell) => /权重|占比|比例|类型/.test(cell));
  }

  private findMarkdownIndicatorColumn(header: string[], moduleColumn = -1, allowSituation = false) {
    return header.findIndex((cell, index) => index !== moduleColumn && (
      /目标维度|指标名称|考核指标|绩效指标|评价维度|考评项|指标|事项|项目/.test(cell)
      || (allowSituation && /情形/.test(cell))
    ));
  }

  private normalizeMarkdownHeading(value: string) {
    return value
      .replace(/\*\*/g, '')
      .replace(/^第?[一二三四五六七八九十百]+[、.．]\s*/, '')
      .replace(/^\d+(?:\.\d+)*[、.．]?\s*/, '')
      .split(/[｜|]/, 1)[0]
      .replace(/\s*(?:模块)?(?:权重|占比|比例)\s*[:：]?\s*\d+(?:\.\d+)?\s*%?\s*$/i, '')
      .replace(/\s*[（(]\s*\d+(?:\.\d+)?\s*%[^）)]*[）)]\s*$/, '')
      .replace(/\s*[（(](?:最高)?[+-]\s*\d+(?:\.\d+)?\s*分[）)]\s*$/, '')
      .trim();
  }

  private comparableMarkdownName(value: string) {
    return this.normalizeMarkdownHeading(value).replace(/[\s\u3000（）()【】\[\]：:、，,。；;·-]/g, '').toLowerCase();
  }

  private extractMarkdownPercent(value: string) {
    const match = value.match(/(\d+(?:\.\d+)?)\s*%/);
    return match ? Number(match[1]) : null;
  }

  private appendMarkdownText(current: string, next: string) {
    if (!next || current.includes(next)) return current;
    return current ? `${current}\n${next}` : next;
  }

  private markdownStandardsForIndicator(
    indicatorName: string,
    section: MarkdownHeading,
    headings: MarkdownHeading[],
    tables: MarkdownTable[],
    lines: string[],
  ) {
    const expected = this.comparableMarkdownName(indicatorName);
    const nestedSections = headings.filter((heading) => (
      heading.start > section.start
      && heading.end <= section.end
      && heading.level > section.level
      && this.comparableMarkdownName(heading.normalizedTitle) === expected
    ));
    const standards = nestedSections.flatMap((heading) => this.markdownStandardsForRange(
      lines,
      heading.start + 1,
      heading.end,
      tables.filter((table) => table.start > heading.start && table.end <= heading.end),
    ));

    for (let index = section.start + 1; index < section.end; index += 1) {
      const marker = (lines[index] ?? '').match(/^\s*\*\*(.+?)\*\*\s*$/)?.[1];
      if (!marker) continue;
      const markerName = this.comparableMarkdownName(marker.replace(/评分说明\s*[:：]?$/, ''));
      if (markerName !== expected) continue;
      let end = section.end;
      for (let cursor = index + 1; cursor < section.end; cursor += 1) {
        if (/^\s*\*\*.+?\*\*\s*$/.test(lines[cursor] ?? '') || /^#{2,6}\s+/.test(lines[cursor] ?? '')) {
          end = cursor;
          break;
        }
      }
      standards.push(...this.markdownStandardsForRange(
        lines,
        index + 1,
        end,
        tables.filter((table) => table.start > index && table.end <= end),
      ));
    }
    return this.uniqueMarkdownText(standards);
  }

  private markdownStandardsForRange(lines: string[], start: number, end: number, tables: MarkdownTable[]) {
    const coveredLines = new Set<number>();
    const standards = tables.flatMap((table) => {
      for (let index = table.start; index < table.end; index += 1) coveredLines.add(index);
      return table.rows.map((row) => row.map((cell) => cell.trim()).filter(Boolean).join('；'));
    });
    for (let index = start; index < end; index += 1) {
      if (coveredLines.has(index)) continue;
      const content = (lines[index] ?? '')
        .trim()
        .replace(/\*\*/g, '')
        .replace(/^\s*(?:[-*]\s*|\d+[.)、]\s*)/, '')
        .replace(/\s{2,}$/, '')
        .replace(/([：:])\s+/g, '$1')
        .trim();
      if (!content || /^#{1,6}\s+|^```|^---+$/.test(content)) continue;
      if (/^(?:指标描述|衡量标准|评分参考|评分说明|评价结构|评价维度|评价内容颗粒度|评分档位|计分规则|特殊口径|计算公式|认定规则|说明)\s*[:：]?$/.test(content)) continue;
      standards.push(content);
    }
    return this.uniqueMarkdownText(standards);
  }

  private uniqueMarkdownText(values: string[]) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  /**
   * Parses exported assessment documents where each module is a level-two
   * heading and the indicator content is written as labelled text blocks.
   * This is intentionally separate from the generic table parser below: in
   * these documents the level-one heading names the document, not a module.
   */
  private parseFieldListMarkdown(markdown: string, warnings: PerformanceParseWarning[]): PerformanceTemplateDefinition | null {
    const lines = markdown.split(/\r?\n/);
    const sections: Array<{ heading: string; start: number; lines: string[] }> = [];
    let current: { heading: string; start: number; lines: string[] } | null = null;

    for (const [index, line] of lines.entries()) {
      const heading = line.match(/^##\s+(.+?)\s*$/);
      if (heading?.[1]) {
        if (current) sections.push(current);
        current = { heading: heading[1], start: index, lines: [] };
      } else if (current) {
        current.lines.push(line);
      }
    }
    if (current) sections.push(current);

    // A module-weight heading distinguishes the field-list export format from
    // ordinary documents that happen to use second-level headings.
    if (!sections.some((section) => /模块权重\s*[:：]?\s*\d+(?:\.\d+)?\s*%?/i.test(section.heading))) return null;

    const normalizeHeading = (value: string) => value
      .replace(/^第?[一二三四五六七八九十百]+[、.]\s*/, '')
      .replace(/^\d+[、.]\s*/, '')
      .replace(/\s*模块权重\s*[:：]?\s*\d+(?:\.\d+)?\s*%?\s*$/i, '')
      .replace(/\s*[（(](?:最高)?[+-]\s*\d+(?:\.\d+)?\s*分[）)]\s*$/, '')
      .trim();
    const percent = (value: string) => {
      const match = value.match(/(\d+(?:\.\d+)?)\s*%/);
      return match ? Number(match[1]) : null;
    };
    const contentLine = (value: string) => value
      .trim()
      .replace(/^\s*(?:[-*]\s*|\d+[.)、]\s*)/, '')
      .replace(/\s{2,}$/, '')
      .trim();
    const fieldMarker = (line: string) => contentLine(line).match(/^(指标描述|衡量标准|评分参考)\s*[:：]?$/)?.[1] ?? null;
    const modules: PerformanceModuleDefinition[] = [];

    for (const section of sections) {
      const headings = section.lines
        .map((line) => line.match(/^###\s+(.+?)\s*$/)?.[1])
        .filter((heading): heading is string => Boolean(heading));
      const declaredWeight = percent(section.heading)
        ?? section.lines.map((line) => line.match(/^\s*(?:[-*]\s*)?(?:权重|权重占比|占比)\s*[:：]\s*(\d+(?:\.\d+)?)\s*%?/i)?.[1]).find(Boolean)
          ? Number(section.lines.map((line) => line.match(/^\s*(?:[-*]\s*)?(?:权重|权重占比|占比)\s*[:：]\s*(\d+(?:\.\d+)?)\s*%?/i)?.[1]).find(Boolean))
          : null;
      const adjustmentGroup = /^(?:加分项|减分项|调整项)$/u.test(normalizeHeading(section.heading));
      const moduleName = adjustmentGroup && headings[0] ? normalizeHeading(headings[0]) : normalizeHeading(section.heading);
      if (!moduleName) continue;

      const inferred = this.inferMarkdownModuleType(moduleName, `${section.heading}\n${section.lines.join('\n')}`);
      const adjustment = inferred.type === 'ADJUSTMENT';
      const metric = inferred.type === 'METRIC';
      const module: PerformanceModuleDefinition = {
        id: `markdown-field-${modules.length + 1}`,
        name: moduleName,
        type: inferred.type,
        enabled: true,
        participatesInTotal: !adjustment,
        weight: adjustment ? null : declaredWeight,
        description: '',
        executor: adjustment || !metric
          ? { type: 'USER', executionMode: 'SINGLE', userIds: [] }
          : { type: 'AUTO', executionMode: 'SINGLE' },
        indicators: [],
        ...(adjustment ? {
          adjustmentDirection: inferred.adjustmentDirection,
          adjustmentMin: 0,
          adjustmentMax: /最高\s*\+?\s*(\d+(?:\.\d+)?)\s*分/.exec(`${section.heading}\n${section.lines.join('\n')}`)?.[1]
            ? Number(/最高\s*\+?\s*(\d+(?:\.\d+)?)\s*分/.exec(`${section.heading}\n${section.lines.join('\n')}`)?.[1])
            : 100,
        } : {}),
      };

      const descriptionLines: string[] = [];
      const standardLines: string[] = [];
      let activeField: 'description' | 'standards' | null = null;
      for (const line of section.lines) {
        if (/^###\s+/.test(line)) continue;
        const marker = fieldMarker(line);
        if (marker) {
          activeField = marker === '指标描述' ? 'description' : 'standards';
          continue;
        }
        const content = contentLine(line);
        if (!content || !activeField) continue;
        if (activeField === 'description') descriptionLines.push(content);
        else standardLines.push(content);
      }

      const singleIndicatorName = normalizeHeading(headings[0] ?? moduleName) || moduleName;
      if (descriptionLines.length <= 1) {
        module.indicators.push({
          id: `${module.id}-indicator-1`,
          name: singleIndicatorName,
          description: descriptionLines[0] ?? '',
          standards: [],
          weight: metric ? 100 : 0,
        });
      } else {
        module.indicators.push(...descriptionLines.map((line, index) => {
          const parenthetical = line.match(/^(.+?)[（(]\s*(.+?)\s*[）)]$/);
          const adjustmentParts = adjustment ? line.split(/[，,]/, 2).map((part) => part.trim()) : [];
          return {
            id: `${module.id}-indicator-${index + 1}`,
            name: parenthetical?.[1]?.trim() || adjustmentParts[0] || line,
            description: parenthetical?.[2]?.trim() || adjustmentParts[1] || '',
            standards: [],
            weight: metric ? 100 / descriptionLines.length : 0,
          };
        }));
      }

      this.assignFieldListStandards(module.indicators, standardLines);
      modules.push(module);
    }

    // Every H2 section is a separate template module. In particular, self
    // assessment is not a fixed pre-step: its presence, weight and position
    // come from the imported document.
    return modules.length ? this.finalizeMarkdownDefinition(markdown, modules, warnings) : null;
  }

  private assignFieldListStandards(indicators: PerformanceIndicatorDefinition[], lines: string[]) {
    const generic: string[] = [];
    const directByIndicatorId = new Map<string, string[]>();
    const explanationsByIndicatorId = new Map<string, Array<{ grade: string; explanation: string }>>();
    let activeIndicator: PerformanceIndicatorDefinition | null = null;
    let scoringExplanation = false;
    const findIndicator = (name: string) => indicators.find((indicator) => indicator.name === name.trim()) ?? null;
    const normalizeStandard = (line: string) => {
      const parenthetical = line.match(/^(.+?)[（(]\s*(.+?)\s*[）)]$/);
      return parenthetical ? `${parenthetical[1].trim()}；评分说明：${parenthetical[2].trim()}` : line;
    };

    for (const line of lines) {
      const scoreHeading = line.match(/^(.+?)评分说明\s*[:：]$/);
      const directHeading = line.match(/^(.+?)\s*[:：]$/);
      const scoredIndicator = scoreHeading?.[1] ? findIndicator(scoreHeading[1]) : null;
      const directIndicator = directHeading?.[1] ? findIndicator(directHeading[1]) : null;
      if (scoredIndicator) {
        activeIndicator = scoredIndicator;
        scoringExplanation = true;
        continue;
      }
      if (directIndicator) {
        activeIndicator = directIndicator;
        scoringExplanation = false;
        continue;
      }

      if (activeIndicator && scoringExplanation) {
        const explanation = line.match(/^([^：:]+)\s*[:：]\s*(.+)$/);
        if (explanation?.[1] && explanation[2]) {
          const entries = explanationsByIndicatorId.get(activeIndicator.id) ?? [];
          entries.push({ grade: explanation[1].trim(), explanation: explanation[2].trim() });
          explanationsByIndicatorId.set(activeIndicator.id, entries);
          continue;
        }
      }

      if (activeIndicator) {
        const entries = directByIndicatorId.get(activeIndicator.id) ?? [];
        entries.push(normalizeStandard(line));
        directByIndicatorId.set(activeIndicator.id, entries);
      } else {
        generic.push(normalizeStandard(line));
      }
    }

    for (const indicator of indicators) {
      const standards = [...generic, ...(directByIndicatorId.get(indicator.id) ?? [])];
      for (const { grade, explanation } of explanationsByIndicatorId.get(indicator.id) ?? []) {
        const standardIndex = standards.findIndex((standard) => standard.includes(grade));
        if (standardIndex >= 0) standards[standardIndex] = `${standards[standardIndex]}；评分说明：${explanation}`;
        else standards.push(`${grade}：评分说明：${explanation}`);
      }
      indicator.standards = standards;
    }
  }

  private toTableCells(line: string) {
    const trimmed = line.trim();
    if (!trimmed.includes('|')) return [];
    const cells = trimmed.split('|');
    if (trimmed.startsWith('|')) cells.shift();
    if (trimmed.endsWith('|')) cells.pop();
    return cells.map((cell) => cell.trim());
  }

  private tableHeaderLine(lines: string[], overviewHeaderIndex: number) {
    let tableIndex = -1;
    for (let index = 0; index < lines.length; index += 1) {
      const cells = this.toTableCells(lines[index] ?? '');
      if (cells.length < 2) continue;
      tableIndex += 1;
      if (tableIndex === overviewHeaderIndex) return index;
    }
    return lines.length;
  }

  private nearestHeadingBefore(lines: string[], beforeLine: number) {
    for (let index = Math.min(beforeLine - 1, lines.length - 1); index >= 0; index -= 1) {
      const match = lines[index]?.match(/^#{1,3}\s+(.+?)\s*$/);
      if (match?.[1]) return match[1].trim().replace(/（[^）]*）|\([^)]*\)/g, '').trim();
    }
    return '';
  }

  private enrichMarkdownModule(module: PerformanceModuleDefinition, lines: string[], warnings: PerformanceParseWarning[]) {
    for (const indicator of module.indicators) {
      const headingIndex = lines.findIndex((line) => line.replace(/^###\s+\d+[.、]?\s*/, '').includes(indicator.name));
      if (headingIndex < 0) {
        warnings.push({ path: `modules.${module.id}.indicators.${indicator.id}`, message: `未在 Markdown 正文章节中找到“${indicator.name}”的详细说明。` });
        continue;
      }
      const nextHeadingIndex = lines.findIndex((line, index) => index > headingIndex && /^###\s+/.test(line));
      const section = lines.slice(headingIndex + 1, nextHeadingIndex < 0 ? lines.length : nextHeadingIndex);
      const action = this.extractMarkdownSection(section, '关键事项 / 行动计划');
      const standard = this.extractMarkdownSection(section, '目标达成衡量标准');
      const scoring = this.extractMarkdownSection(section, '评分参考');
      indicator.description = action || indicator.description;
      indicator.standards = [standard, scoring].filter(Boolean);
      if (!indicator.description) warnings.push({ path: `modules.${module.id}.indicators.${indicator.id}.description`, sourceLine: headingIndex + 1, message: `“${indicator.name}”未提供可解析的关键事项/行动计划。` });
      if (indicator.standards.length === 0) warnings.push({ path: `modules.${module.id}.indicators.${indicator.id}.standards`, sourceLine: headingIndex + 1, message: `“${indicator.name}”未提供可解析的衡量标准或评分参考。` });
    }
  }

  private extractMarkdownSection(lines: string[], title: string) {
    const start = lines.findIndex((line) => line.replace(/[：:]/g, '').trim() === title);
    if (start < 0) return '';
    const result: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (/^\*\*[^*]+\*\*/.test(line) || /^###\s+/.test(line)) break;
      if (line.trim()) result.push(line.trim());
    }
    return result.join('\n');
  }

  private finalizeMarkdownDefinition(markdown: string, modules: PerformanceModuleDefinition[], warnings: PerformanceParseWarning[]) {
    const fixedModules = modules.filter((module) => module.participatesInTotal);
    const fixedWeight = fixedModules.reduce((sum, module) => sum + (module.weight ?? 0), 0);
    if (Math.abs(fixedWeight - 100) > 0.0001) warnings.push({ path: 'modules', message: `Markdown 固定模块权重合计为 ${fixedWeight}%，必须在编辑器中调整至 100% 后才能发布。` });
    for (const module of modules) {
      const indicatorWeight = module.indicators.reduce((sum, indicator) => sum + indicator.weight, 0);
      if (module.type === 'METRIC' && module.indicators.length && Math.abs(indicatorWeight - 100) > 0.0001) warnings.push({ path: `modules.${module.id}.indicators`, message: `“${module.name}”指标权重合计为 ${indicatorWeight}%，需确认其是模块内权重还是全局权重。` });
    }
    return {
      schemaVersion: 1 as const,
      name: (markdown.match(/^#\s+(.+)$/m)?.[1] ?? '未命名绩效模板').trim(),
      modules,
    };
  }

  private validateIndicators(value: unknown, path: string, errors: PerformanceParseError[]): PerformanceIndicatorDefinition[] {
    if (!Array.isArray(value)) {
      errors.push({ path, message: '指标必须是数组' });
      return [];
    }
    const ids = new Set<string>();
    return value.flatMap((rawIndicator, index) => {
      const itemPath = `${path}[${index}]`;
      if (!this.isRecord(rawIndicator)) {
        errors.push({ path: itemPath, message: '指标必须是对象' });
        return [];
      }
      const id = this.stringValue(rawIndicator.id);
      const name = this.stringValue(rawIndicator.name);
      const weight = this.numberValue(rawIndicator.weight);
      if (!id || ids.has(id)) errors.push({ path: `${itemPath}.id`, message: '指标 ID 不能为空且不能重复' });
      if (id) ids.add(id);
      if (!name) errors.push({ path: `${itemPath}.name`, message: '指标名称不能为空' });
      if (weight === null || weight < 0 || weight > 100) errors.push({ path: `${itemPath}.weight`, message: '指标权重必须为 0-100 的数字' });
      const standards = Array.isArray(rawIndicator.standards) && rawIndicator.standards.every((entry) => typeof entry === 'string')
        ? rawIndicator.standards as string[] : [];
      const dataField = this.stringValue(rawIndicator.dataField);
      if (dataField && !RULE_FIELD_NAME.test(dataField)) errors.push({ path: `${itemPath}.dataField`, message: '业务数据字段名只能使用字母、数字、点和下划线，且必须以字母开头' });
      const rule = rawIndicator.rule;
      if (rule !== undefined && !this.validateRule(rule, `${itemPath}.rule`, errors)) return [];
      return id && name && weight !== null ? [{ id, name, description: this.stringValue(rawIndicator.description) ?? '', standards, weight, dataField: dataField ?? undefined, rule: rule as PerformanceRuleNode | undefined }] : [];
    });
  }

  private validateRule(value: unknown, path: string, errors: PerformanceParseError[], depth = 0): boolean {
    if (depth > 20) {
      errors.push({ path, message: '规则嵌套层级不能超过 20 层' });
      return false;
    }
    if (!this.isRecord(value) || !RULE_OPERATORS.has(String(value.op))) {
      errors.push({ path, message: '规则节点操作不在安全白名单中' });
      return false;
    }
    const op = String(value.op);
    if (op === 'constant') {
      if (typeof value.value !== 'number' || !Number.isFinite(value.value)) errors.push({ path: `${path}.value`, message: 'constant 必须为有限数字' });
      return true;
    }
    if (op === 'field') {
      if (!this.isNonEmptyString(value.field) || !RULE_FIELD_NAME.test(value.field)) errors.push({ path: `${path}.field`, message: 'field 必须是以字母开头的安全业务字段名' });
      return true;
    }
    if (op === 'if') {
      if (!this.isRecord(value.condition) || !this.isNonEmptyString(value.condition.field) || !RULE_FIELD_NAME.test(value.condition.field) || !CONDITION_OPERATORS.has(String(value.condition.operator)) || typeof value.condition.value !== 'number' || !Number.isFinite(value.condition.value)) {
        errors.push({ path: `${path}.condition`, message: 'if 条件无效' });
      }
      if (!this.validateRule(value.then, `${path}.then`, errors, depth + 1)) return false;
      if (!this.validateRule(value.otherwise, `${path}.otherwise`, errors, depth + 1)) return false;
      return true;
    }
    if (!Array.isArray(value.args) || value.args.length < 1 || value.args.length > 8) {
      errors.push({ path: `${path}.args`, message: '运算参数数量必须为 1-8' });
      return false;
    }
    return value.args.every((arg, index) => this.validateRule(arg, `${path}.args[${index}]`, errors, depth + 1));
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private isNonEmptyString(value: unknown): value is string {
    return this.stringValue(value) !== null;
  }

  private numberValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
