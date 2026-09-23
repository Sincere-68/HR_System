import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS } from '@hr-demo/shared';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { PartTimeRecordsController } from './part-time-records.controller';

const user = { id: 'user-1' } as never;

describe('PartTimeRecordsController', () => {
  it('registers the isolated part-time record routes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PartTimeRecordsController)).toBe('employment/part-time-records');
    expect(Reflect.getMetadata(PATH_METADATA, PartTimeRecordsController.prototype.create)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, PartTimeRecordsController.prototype.create)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, PartTimeRecordsController.prototype.findAll)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, PartTimeRecordsController.prototype.findAll)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, PartTimeRecordsController.prototype.findOne)).toBe(':id');
    expect(Reflect.getMetadata(PATH_METADATA, PartTimeRecordsController.prototype.activate)).toBe(':id/activate');
    expect(Reflect.getMetadata(PATH_METADATA, PartTimeRecordsController.prototype.end)).toBe(':id/end');
  });

  it.each([
    ['create', PERMISSIONS.EMPLOYEE_UPDATE],
    ['findAll', PERMISSIONS.EMPLOYEE_READ],
    ['findOne', PERMISSIONS.EMPLOYEE_READ],
    ['activate', PERMISSIONS.EMPLOYEE_UPDATE],
    ['end', PERMISSIONS.EMPLOYEE_UPDATE],
  ])('protects %s with %s', (method, permission) => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, PartTimeRecordsController.prototype[method as keyof PartTimeRecordsController]))
      .toEqual([permission]);
  });

  it('delegates all route arguments without touching the legacy employment controller', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ id: 'record-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [] }),
      findOne: jest.fn().mockResolvedValue({ id: 'record-1' }),
      activate: jest.fn().mockResolvedValue({ id: 'record-1' }),
      end: jest.fn().mockResolvedValue({ id: 'record-1' }),
    };
    const controller = new PartTimeRecordsController(service as never);
    const dto = { type: '顾问' } as never;
    const query = { page: 1, pageSize: 10 } as never;
    const endDto = { endDate: '2026-09-20' } as never;

    await controller.create(user, dto);
    await controller.findAll(user, query);
    await controller.findOne(user, 'record-1');
    await controller.activate(user, 'record-1');
    await controller.end(user, 'record-1', endDto);

    expect(service.create).toHaveBeenCalledWith(user, dto);
    expect(service.findAll).toHaveBeenCalledWith(user, query);
    expect(service.findOne).toHaveBeenCalledWith(user, 'record-1');
    expect(service.activate).toHaveBeenCalledWith(user, 'record-1');
    expect(service.end).toHaveBeenCalledWith(user, 'record-1', endDto);
  });
});
