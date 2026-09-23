import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS } from '@hr-demo/shared';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { EmploymentConversionsController } from './employment-conversions.controller';

const user = {
  id: 'user-1',
  username: 'hr-admin',
  displayName: '虚构管理员',
  role: 'ADMIN' as const,
  roleName: '系统管理员',
  permissions: ['employee.read', 'employee.update'] as never,
  organizationIds: ['org-source', 'org-target'],
};

describe('EmploymentConversionsController', () => {
  function createSubject() {
    const service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      activate: jest.fn(),
    };
    return {
      controller: new EmploymentConversionsController(service as never),
      service,
    };
  }

  it('registers the conversion resource and required HTTP methods', () => {
    const controller = new EmploymentConversionsController({} as never);

    expect(Reflect.getMetadata(PATH_METADATA, EmploymentConversionsController)).toBe('employment/conversions');
    expect(Reflect.getMetadata(PATH_METADATA, controller.create)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.create)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, controller.findAll)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.findAll)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, controller.findOne)).toBe(':id');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.findOne)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, controller.activate)).toBe(':id/activate');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.activate)).toBe(RequestMethod.POST);
  });

  it.each([
    ['create', PERMISSIONS.EMPLOYEE_UPDATE],
    ['findAll', PERMISSIONS.EMPLOYEE_READ],
    ['findOne', PERMISSIONS.EMPLOYEE_READ],
    ['activate', PERMISSIONS.EMPLOYEE_UPDATE],
  ])('protects %s with %s', (method, permission) => {
    const controller = new EmploymentConversionsController({} as never);

    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller[method as keyof EmploymentConversionsController])).toEqual([permission]);
  });

  it('delegates create, list, detail, and activation requests without changing arguments', async () => {
    const { controller, service } = createSubject();
    const createDto = { employeeId: 'employee-1' };
    const query = { page: 1, pageSize: 10 };

    service.create.mockResolvedValue({ id: 'conversion-1' });
    service.findAll.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
    service.findOne.mockResolvedValue({ id: 'conversion-1' });
    service.activate.mockResolvedValue({ id: 'conversion-1', status: 'COMPLETED' });

    await expect(controller.create(user, createDto as never)).resolves.toEqual({ id: 'conversion-1' });
    await expect(controller.findAll(user, query as never)).resolves.toEqual(expect.objectContaining({ data: [] }));
    await expect(controller.findOne(user, 'conversion-1')).resolves.toEqual({ id: 'conversion-1' });
    await expect(controller.activate(user, 'conversion-1')).resolves.toEqual({ id: 'conversion-1', status: 'COMPLETED' });

    expect(service.create).toHaveBeenCalledWith(user, createDto);
    expect(service.findAll).toHaveBeenCalledWith(user, query);
    expect(service.findOne).toHaveBeenCalledWith(user, 'conversion-1');
    expect(service.activate).toHaveBeenCalledWith(user, 'conversion-1');
  });
});
