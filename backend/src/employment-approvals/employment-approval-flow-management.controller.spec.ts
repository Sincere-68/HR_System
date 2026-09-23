import 'reflect-metadata';
import { PERMISSIONS } from '@hr-demo/shared';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { EmploymentApprovalFlowManagementController } from './employment-approval-flow-management.controller';

describe('EmploymentApprovalFlowManagementController permissions', () => {
  const controller = new EmploymentApprovalFlowManagementController({} as never);

  it.each([
    'createDefinition',
    'createVersion',
    'updateDefinition',
    'updateVersion',
    'publishVersion',
    'archiveDefinition',
  ])('protects %s with the flow-management permission', (method) => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller[method as keyof EmploymentApprovalFlowManagementController])).toEqual([
      PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE,
    ]);
  });
});
