import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS } from '@hr-demo/shared';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { EmploymentApprovalFlowManagementController } from './employment-approval-flow-management.controller';

describe('EmploymentApprovalFlowManagementController permissions', () => {
  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOptions: jest.fn(),
    createDefinition: jest.fn(),
    createVersion: jest.fn(),
    updateDefinition: jest.fn(),
    updateVersion: jest.fn(),
    publishVersion: jest.fn(),
    archiveDefinition: jest.fn(),
  };
  const controller = new EmploymentApprovalFlowManagementController(service as never);
  const user = { id: 'user-1' } as never;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    'findAll',
    'findOne',
    'findOptions',
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

  it('registers list, options, and detail reads before the parameterized route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, controller.findAll)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.findAll)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, controller.findOptions)).toBe('options');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.findOptions)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, controller.findOne)).toBe(':definitionId');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.findOne)).toBe(RequestMethod.GET);
  });

  it('delegates read requests without changing arguments', async () => {
    const query = { page: 2, pageSize: 20, keyword: '转正式' } as never;
    service.findAll.mockResolvedValue({ data: [] });
    service.findOne.mockResolvedValue({ id: 'definition-1' });
    service.findOptions.mockResolvedValue({ users: [], roles: [], jobTitles: [] });

    await controller.findAll(user, query);
    await controller.findOptions(user);
    await controller.findOne(user, 'definition-1');

    expect(service.findAll).toHaveBeenCalledWith(user, query);
    expect(service.findOptions).toHaveBeenCalledWith(user);
    expect(service.findOne).toHaveBeenCalledWith(user, 'definition-1');
  });
});
