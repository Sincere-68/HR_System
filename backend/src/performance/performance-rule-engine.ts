import { BadRequestException, Injectable } from '@nestjs/common';
import type { PerformanceRuleNode } from '@hr-demo/shared';

export type RuleContext = Record<string, number>;

@Injectable()
export class PerformanceRuleEngine {
  evaluate(rule: PerformanceRuleNode, context: RuleContext): number {
    const result = this.evaluateNode(rule, context);
    if (!Number.isFinite(result)) throw new BadRequestException('绩效规则计算结果不是有限数字');
    return result;
  }

  private evaluateNode(node: PerformanceRuleNode, context: RuleContext): number {
    switch (node.op) {
      case 'constant':
        return this.requireNumber(node.value);
      case 'field': {
        const value = context[node.field ?? ''];
        if (!Number.isFinite(value)) throw new BadRequestException(`绩效规则字段不存在或不是数字：${node.field ?? ''}`);
        return value;
      }
      case 'if': {
        const condition = node.condition;
        if (!condition) throw new BadRequestException('绩效条件缺少 condition');
        const left = context[condition.field];
        if (!Number.isFinite(left)) throw new BadRequestException(`绩效条件字段不存在：${condition.field}`);
        const matched = condition.operator === '<' ? left < condition.value
          : condition.operator === '<=' ? left <= condition.value
            : condition.operator === '>' ? left > condition.value
              : condition.operator === '>=' ? left >= condition.value
                : condition.operator === '=' ? left === condition.value : left !== condition.value;
        return this.evaluateNode(matched ? node.then! : node.otherwise!, context);
      }
      default: {
        const args = node.args?.map((arg) => this.evaluateNode(arg, context)) ?? [];
        if (args.length === 0) throw new BadRequestException(`绩效运算 ${node.op} 缺少参数`);
        if (node.op === 'add') return args.reduce((sum, value) => sum + value, 0);
        if (node.op === 'subtract') return args.slice(1).reduce((result, value) => result - value, args[0]!);
        if (node.op === 'multiply') return args.reduce((result, value) => result * value, 1);
        if (node.op === 'divide') return args.slice(1).reduce((result, value) => {
          if (value === 0) throw new BadRequestException('绩效规则不能除以零');
          return result / value;
        }, args[0]!);
        if (node.op === 'min') return Math.min(...args);
        if (node.op === 'max') return Math.max(...args);
        throw new BadRequestException(`不支持的绩效规则操作：${node.op}`);
      }
    }
  }

  private requireNumber(value: number | undefined) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new BadRequestException('绩效常量必须是有限数字');
    return value;
  }
}
