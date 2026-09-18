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

const JSON_BLOCK = /```(?:performance-template|json)\s*\n([\s\S]*?)```/i;
const MODULE_TYPES = new Set(['METRIC', 'EVALUATION', 'ADJUSTMENT']);
const EXECUTOR_TYPES = new Set(['AUTO', 'USER', 'DIRECTORY']);
const EXECUTION_MODES = new Set(['SINGLE', 'MULTIPLE']);
const DIRECTORY_TYPES = new Set(['POSITION', 'JOB_TITLE']);
const RULE_OPERATORS = new Set(['constant', 'field', 'add', 'subtract', 'multiply', 'divide', 'min', 'max', 'if']);
const CONDITION_OPERATORS = new Set(['<', '<=', '>', '>=', '=', '!=']);
const RULE_FIELD_NAME = /^[A-Za-z][A-Za-z0-9_.]{0,127}$/;
const WORKFLOW_STEP_TYPES = new Set(['REVIEW', 'CONFIRMATION', 'APPROVAL', 'HR_ARCHIVE']);
const WORKFLOW_REJECTION_STRATEGIES = new Set(['END', 'RETURN_PREVIOUS', 'RETURN_TO_STEP']);

@Injectable()
export class PerformanceTemplateParser {
  parse(sourceMarkdown: string, sourceName: string | null = null): PerformanceTemplateParseResult {
    const errors: PerformanceParseError[] = [];
    const warnings: PerformanceParseWarning[] = [];
    if (!sourceMarkdown.trim()) {
      return { sourceName, sourceMarkdown, definition: null, errors: [{ path: 'sourceMarkdown', message: 'Markdown 内容不能为空' }], warnings };
    }

    const match = sourceMarkdown.match(JSON_BLOCK);
    if (!match?.[1]) {
      const legacyDefinition = this.parseMarkdownDocument(sourceMarkdown, warnings);
      if (legacyDefinition) return { sourceName, sourceMarkdown, definition: legacyDefinition, errors, warnings };
      errors.push({ path: 'definition', message: '未识别到可解析的 Markdown 模块/指标结构' });
      return { sourceName, sourceMarkdown, definition: null, errors, warnings };
    }

    let value: unknown;
    try {
      value = JSON.parse(match[1]);
    } catch {
      errors.push({ path: 'definition', message: 'performance-template JSON 格式无效' });
      return { sourceName, sourceMarkdown, definition: null, errors, warnings };
    }

    const definition = this.validateDefinition(value, errors);
    return { sourceName, sourceMarkdown, definition, errors, warnings };
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
    const lines = markdown.split(/\r?\n/);
    const lineOf = (needle: string) => Math.max(1, lines.findIndex((line) => line.includes(needle)) + 1);
    if (/<\/?[A-Za-z][^>]*>/.test(markdown)) return null;
    const overviewRows = lines
      .filter((line) => line.trim().startsWith('|'))
      .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
    const overviewHeaderIndex = overviewRows.findIndex((row) => row.includes('目标分类') && row.includes('目标维度') && row.includes('权重占比'));
    if (overviewHeaderIndex >= 0) {
      const overviewModules = new Map<string, PerformanceModuleDefinition>();
      for (const [index, row] of overviewRows.slice(overviewHeaderIndex + 2).entries()) {
        const rawCategory = row[0] ?? '';
        const category = rawCategory.replace(/（[^）]*）|\([^)]*\)/g, '').trim();
        const indicatorName = row[1]?.trim();
        const weightMatch = row[2]?.match(/(\d+(?:\.\d+)?)\s*%/);
        if (!category || !indicatorName || !weightMatch) continue;
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
        module.indicators.push({ id: `markdown-indicator-${module.id}-${index + 1}`, name: indicatorName, description: row[3] ?? '', standards: [], weight });
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
    const flushIndicator = () => {
      if (currentModule && currentIndicator) currentModule.indicators.push(currentIndicator);
      currentIndicator = null;
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

    for (const line of lines) {
      const levelOne = line.match(/^#\s+(.+?)\s*$/);
      if (levelOne) {
        const rawName = levelOne[1] ?? '';
        const weight = percent(rawName);
        flushModule();
        const name = cleanHeading(rawName);
        currentModule = {
          id: `legacy-${modules.length + 1}`,
          name,
          type: 'EVALUATION',
          enabled: true,
          participatesInTotal: true,
          weight,
          description: '',
          executor: { type: 'USER', executionMode: 'SINGLE', userIds: [] },
          indicators: [],
        };
        warnings.push({ path: `modules.${currentModule.id}.type`, sourceLine: lineOf(rawName), message: `“${name}”的模块类型需要在编辑器中确认；未根据标题自动推断模块类型或调整方向。` });
        continue;
      }

      const levelTwo = line.match(/^##\s+(.+?)\s*$/);
      if (levelTwo) {
        const rawName = levelTwo[1] ?? '';
        if (/使用说明|考核指标总览/.test(rawName)) continue;
        flushModule();
        const name = cleanHeading(rawName);
        const weight = percent(rawName);
        currentModule = {
          id: `legacy-${modules.length + 1}`,
          name,
          // Headings are source material only. HR must explicitly choose module
          // type, executor and adjustment behavior in the structured editor.
          type: 'EVALUATION' as const,
          enabled: true,
          participatesInTotal: true,
          weight,
          description: '',
          executor: { type: 'USER' as const, executionMode: 'SINGLE' as const, userIds: [] },
          indicators: [],
        };
        warnings.push({ path: `modules.${currentModule.id}.type`, sourceLine: lineOf(rawName), message: `“${name}”的模块类型需要在编辑器中确认；未根据标题自动推断模块类型或调整方向。` });
        continue;
      }

      const levelThree = line.match(/^###\s+(.+?)\s*$/);
      if (levelThree && currentModule) {
        const rawName = levelThree[1] ?? '';
        const weight = percent(rawName);
        if (weight !== null || /权重/.test(rawName)) {
          flushIndicator();
          const name = cleanHeading(rawName).replace(/[（(]\s*权重\s*[:：]?\s*\d+(?:\.\d+)?\s*%\s*[）)]/, '').trim();
          currentIndicator = {
            id: `legacy-indicator-${currentModule.id}-${currentModule.indicators.length + 1}`,
            name: name || cleanHeading(rawName),
            description: '',
            standards: [],
            weight: weight ?? 0,
          };
        }
        continue;
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
      if (module.indicators.length && Math.abs(indicatorWeight - 100) > 0.0001) warnings.push({ path: `modules.${module.id}.indicators`, message: `“${module.name}”指标权重合计为 ${indicatorWeight}%，需确认其是模块内权重还是全局权重。` });
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
