import 'reflect-metadata';
import { PERMISSIONS } from '@hr-demo/shared';
import { PerformanceController } from './performance.controller';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

describe('PerformanceController permissions', () => {
  const controller = new PerformanceController({} as never);

  it.each([
    ['parseTemplate', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['createTemplate', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['createTemplateVersion', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['publishTemplateVersion', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['createCycle', PERMISSIONS.PERFORMANCE_CYCLE_MANAGE],
    ['startCycle', PERMISSIONS.PERFORMANCE_CYCLE_MANAGE],
    ['submitTask', PERMISSIONS.PERFORMANCE_TASK_HANDLE],
    ['modifyResult', PERMISSIONS.PERFORMANCE_RESULT_MODIFY],
    ['updateAmountBase', PERMISSIONS.PERFORMANCE_AMOUNT_BASE_MANAGE],
  ])('protects %s with %s', (method, permission) => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller[method as keyof PerformanceController])).toEqual([permission]);
  });
});
