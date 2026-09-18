import 'reflect-metadata';
import { PERMISSIONS } from '@hr-demo/shared';
import { PerformanceController } from './performance.controller';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

describe('PerformanceController permissions', () => {
  const controller = new PerformanceController({} as never);

  it.each([
    ['parseTemplate', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['createTemplate', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['copyTemplate', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['archiveTemplate', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['createTemplateVersion', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['publishTemplateVersion', PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE],
    ['createCycle', PERMISSIONS.PERFORMANCE_CYCLE_MANAGE],
    ['startCycle', PERMISSIONS.PERFORMANCE_CYCLE_MANAGE],
    ['getParticipantWorkflow', PERMISSIONS.PERFORMANCE_READ],
    ['getParticipantAssessmentDetail', PERMISSIONS.PERFORMANCE_READ],
    ['archiveCycle', PERMISSIONS.PERFORMANCE_CYCLE_MANAGE],
    ['addCycleParticipants', PERMISSIONS.PERFORMANCE_CYCLE_MANAGE],
    ['submitTask', PERMISSIONS.PERFORMANCE_TASK_HANDLE],
    ['modifyResult', PERMISSIONS.PERFORMANCE_RESULT_MODIFY],
    ['createEmployeeAmountBase', PERMISSIONS.PERFORMANCE_AMOUNT_BASE_MANAGE],
  ])('protects %s with %s', (method, permission) => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller[method as keyof PerformanceController])).toEqual([permission]);
  });

  it('keeps Feishu card actions public while leaving task submission permission-protected', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller.handleFeishuCardAction)).toBe(true);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.submitWorkflowTask)).toEqual([PERMISSIONS.PERFORMANCE_TASK_HANDLE]);
  });
});
