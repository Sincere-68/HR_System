import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  PerformanceIndicatorDefinition,
  PerformanceModuleDefinition,
  PerformanceParseError,
  PerformanceRuleNode,
  PerformanceTemplateDefinition,
  PerformanceTemplateParseResult,
} from '@hr-demo/shared';

const JSON_BLOCK = /```(?:performance-template|json)\s*\n([\s\S]*?)```/i;
const MODULE_TYPES = new Set(['METRIC', 'EVALUATION', 'ADJUSTMENT']);
const EXECUTOR_TYPES = new Set(['AUTO', 'USER', 'DIRECTORY']);
const DIRECTORY_TYPES = new Set(['POSITION', 'JOB_TITLE']);
const RULE_OPERATORS = new Set(['constant', 'field', 'add', 'subtract', 'multiply', 'divide', 'min', 'max', 'if']);
const CONDITION_OPERATORS = new Set(['<', '<=', '>', '>=', '=', '!=']);

@Injectable()
export class PerformanceTemplateParser {
  parse(sourceMarkdown: string, sourceName: string | null = null): PerformanceTemplateParseResult {
    const errors: PerformanceParseError[] = [];
    if (!sourceMarkdown.trim()) {
      return { sourceName, sourceMarkdown, definition: null, errors: [{ path: 'sourceMarkdown', message: 'Markdown 内容不能为空' }] };
    }

    const match = sourceMarkdown.match(JSON_BLOCK);
    if (!match?.[1]) {
      const legacyDefinition = this.parseLegacyMarkdown(sourceMarkdown);
      if (legacyDefinition) return { sourceName, sourceMarkdown, definition: legacyDefinition, errors };
      errors.push({ path: 'definition', message: 'Markdown 中缺少 performance-template JSON 代码块，且未识别到模块结构表' });
      return { sourceName, sourceMarkdown, definition: null, errors };
    }

    let value: unknown;
    try {
      value = JSON.parse(match[1]);
    } catch {
      errors.push({ path: 'definition', message: 'performance-template JSON 格式无效' });
      return { sourceName, sourceMarkdown, definition: null, errors };
    }

    const definition = this.validateDefinition(value, errors);
    return { sourceName, sourceMarkdown, definition, errors };
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
      if (type === 'METRIC' && executor?.type !== 'AUTO') errors.push({ path: `${path}.executor`, message: '业务指标模块只能使用 AUTO 执行人' });
      if ((type === 'EVALUATION' || type === 'ADJUSTMENT') && executor?.type === 'AUTO') errors.push({ path: `${path}.executor`, message: '人工评估和调整模块不能使用 AUTO 执行人' });
      if (type === 'METRIC' && indicators.length > 0) {
        const total = indicators.reduce((sum, indicator) => sum + indicator.weight, 0);
        if (Math.abs(total - 100) > 0.0001) errors.push({ path: `${path}.indicators`, message: `业务指标权重合计必须为 100%，当前为 ${total}%` });
      }
      if (type === 'ADJUSTMENT') {
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
    return errors.length === 0
      ? { schemaVersion: 1, name: value.name as string, description: this.stringValue(value.description) ?? undefined, modules }
      : null;
  }

  assertValidDefinition(value: unknown, requireExecutorDetails = false) {
    const errors: PerformanceParseError[] = [];
    const definition = this.validateDefinition(value, errors, requireExecutorDetails);
    if (!definition) throw new BadRequestException(errors.map((error) => `${error.path}: ${error.message}`));
    return definition;
  }

  private validateExecutor(value: unknown, path: string, errors: PerformanceParseError[], requireDetails: boolean) {
    if (!this.isRecord(value) || !EXECUTOR_TYPES.has(String(value.type))) {
      errors.push({ path, message: '执行人配置必须为 AUTO、USER 或 DIRECTORY' });
      return null;
    }
    const type = String(value.type) as 'AUTO' | 'USER' | 'DIRECTORY';
    if (type === 'AUTO') return { type } as const;
    if (type === 'USER') {
      if (requireDetails && !this.isNonEmptyString(value.userId)) errors.push({ path: `${path}.userId`, message: '具体执行人必须指定 userId' });
      return { type, userId: this.stringValue(value.userId) ?? undefined };
    }
    const directoryType = this.stringValue(value.directoryType);
    if (requireDetails && (!directoryType || !DIRECTORY_TYPES.has(directoryType) || !this.isNonEmptyString(value.directoryId))) {
      errors.push({ path, message: '岗位执行人必须指定 directoryType 和 directoryId' });
    }
    return {
      type,
      directoryType: directoryType as 'POSITION' | 'JOB_TITLE',
      directoryId: this.stringValue(value.directoryId) ?? undefined,
    };
  }

  private parseLegacyMarkdown(markdown: string): PerformanceTemplateDefinition | null {
    const lines = markdown.split(/\r?\n/);
    const overviewRows = lines
      .filter((line) => line.trim().startsWith('|'))
      .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
    const overviewHeaderIndex = overviewRows.findIndex((row) => row.includes('目标分类') && row.includes('目标维度') && row.includes('权重占比'));
    if (overviewHeaderIndex >= 0) {
      const overviewModules = new Map<string, PerformanceModuleDefinition>();
      for (const [index, row] of overviewRows.slice(overviewHeaderIndex + 2).entries()) {
        const category = (row[0] ?? '').replace(/（[^）]*）|\([^)]*\)/g, '').trim();
        const indicatorName = row[1]?.trim();
        const weightMatch = row[2]?.match(/(\d+(?:\.\d+)?)\s*%/);
        if (!category || !indicatorName || !weightMatch) continue;
        const weight = Number(weightMatch[1]);
        const moduleId = `legacy-${overviewModules.size + 1}`;
        const existing = overviewModules.get(category);
        const module = existing ?? {
          id: moduleId,
          name: category,
          type: /指标|运营|业务/.test(category) ? 'METRIC' as const : 'EVALUATION' as const,
          enabled: true,
          participatesInTotal: true,
          weight: 0,
          description: '',
          executor: { type: /指标|运营|业务/.test(category) ? 'AUTO' as const : 'USER' as const },
          indicators: [],
        };
        module.weight = (module.weight ?? 0) + weight;
        module.indicators.push({ id: `legacy-indicator-${module.id}-${index + 1}`, name: indicatorName, description: row[3] ?? '', standards: [], weight });
        overviewModules.set(category, module);
      }
      if (overviewModules.size > 0) return { schemaVersion: 1, name: (markdown.match(/^#\s+(.+)$/m)?.[1] ?? '未命名绩效模板').trim(), modules: [...overviewModules.values()] };
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
      const levelTwo = line.match(/^##\s+(.+?)\s*$/);
      if (levelTwo) {
        const rawName = levelTwo[1] ?? '';
        if (/使用说明|考核指标总览|绩效设计核心逻辑|HRBP 分工总览|HRBP 分工及绩效/.test(rawName)) continue;
        flushModule();
        const name = cleanHeading(rawName);
        const weight = percent(rawName);
        const type = /调整|扣减|奖励/.test(name) ? 'ADJUSTMENT' : /运营|业务达成|业务指标|指标/.test(name) ? 'METRIC' : 'EVALUATION';
        currentModule = {
          id: `legacy-${modules.length + 1}`,
          name,
          type,
          enabled: true,
          participatesInTotal: type !== 'ADJUSTMENT',
          weight: type === 'ADJUSTMENT' ? null : weight,
          description: '',
          executor: { type: type === 'METRIC' ? 'AUTO' : 'USER' },
          indicators: [],
          ...(type === 'ADJUSTMENT' ? { adjustmentDirection: /扣减/.test(name) ? 'DEDUCT' as const : 'ADD' as const, adjustmentMin: 0, adjustmentMax: 100 } : {}),
        };
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
    for (const module of modules) {
      if (module.type === 'METRIC' && module.indicators.length === 0) {
        module.indicators.push({ id: `legacy-indicator-${module.id}-1`, name: module.name, description: '', standards: [], weight: 100 });
      }
    }
    return {
      schemaVersion: 1,
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
      const rule = rawIndicator.rule;
      if (rule !== undefined && !this.validateRule(rule, `${itemPath}.rule`, errors)) return [];
      return id && name && weight !== null ? [{ id, name, description: this.stringValue(rawIndicator.description) ?? '', standards, weight, dataField: this.stringValue(rawIndicator.dataField) ?? undefined, rule: rule as PerformanceRuleNode | undefined }] : [];
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
      if (!this.isNonEmptyString(value.field)) errors.push({ path: `${path}.field`, message: 'field 不能为空' });
      return true;
    }
    if (op === 'if') {
      if (!this.isRecord(value.condition) || !this.isNonEmptyString(value.condition.field) || !CONDITION_OPERATORS.has(String(value.condition.operator)) || typeof value.condition.value !== 'number') {
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
