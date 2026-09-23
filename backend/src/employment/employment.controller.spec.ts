import 'reflect-metadata';
import { RequestMethod, StreamableFile } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS } from '@hr-demo/shared';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { EmploymentController } from './employment.controller';

const user = {
  id: 'user-1',
  username: 'hr-admin',
  displayName: '虚构管理员',
  role: 'ADMIN' as const,
  roleName: '系统管理员',
  permissions: ['employee.read', 'employee.update'] as never,
  organizationIds: ['org-a'],
};

function createController() {
  const service = {
    findProbation: jest.fn(),
    findProbationApprovers: jest.fn(),
    getProbationImportTemplate: jest.fn(),
    importProbation: jest.fn(),
    exportProbation: jest.fn(),
    updateProbation: jest.fn(),
    startProbationEvaluations: jest.fn(),
    startProbationEvaluation: jest.fn(),
    startProbationConfirmations: jest.fn(),
    submitProbationConfirmation: jest.fn(),
    confirmProbation: jest.fn(),
    approveProbation: jest.fn(),
    remindProbationApproval: jest.fn(),
    transferProbationApproval: jest.fn(),
    returnProbationToEvaluation: jest.fn(),
  };
  return {
    controller: new EmploymentController(service as never, {} as never, {} as never),
    service,
  };
}

describe('EmploymentController probation routes', () => {
  const controller = new EmploymentController({} as never, {} as never, {} as never);

  it('registers the multipart import endpoint at the documented POST path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, EmploymentController)).toBe('employment');
    expect(Reflect.getMetadata(PATH_METADATA, controller.importProbation)).toBe('probation/import');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.importProbation)).toBe(RequestMethod.POST);
  });

  it.each([
    ['findProbation', PERMISSIONS.EMPLOYEE_READ],
    ['exportProbation', PERMISSIONS.EMPLOYEE_READ],
    ['findProbationApprovers', PERMISSIONS.EMPLOYEE_UPDATE],
    ['probationImportTemplate', PERMISSIONS.EMPLOYEE_UPDATE],
    ['importProbation', PERMISSIONS.EMPLOYEE_UPDATE],
    ['updateProbation', PERMISSIONS.EMPLOYEE_UPDATE],
    ['startProbationEvaluations', PERMISSIONS.EMPLOYEE_UPDATE],
    ['startProbationEvaluation', PERMISSIONS.EMPLOYEE_UPDATE],
    ['startProbationConfirmations', PERMISSIONS.EMPLOYEE_UPDATE],
    ['submitProbationConfirmation', PERMISSIONS.EMPLOYEE_UPDATE],
    ['confirmProbation', PERMISSIONS.EMPLOYEE_UPDATE],
    ['approveProbation', PERMISSIONS.EMPLOYEE_UPDATE],
    ['remindProbationApproval', PERMISSIONS.EMPLOYEE_UPDATE],
    ['transferProbationApproval', PERMISSIONS.EMPLOYEE_UPDATE],
    ['returnProbationToEvaluation', PERMISSIONS.EMPLOYEE_UPDATE],
  ])('protects %s with %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        controller[method as keyof EmploymentController],
      ),
    ).toEqual([permission]);
  });

  it('passes the file and request audit context to the probation import service', async () => {
    const { controller: subject, service } = createController();
    const file = { originalname: '试用人员.csv', buffer: Buffer.from('csv') };
    const request = { get: jest.fn().mockReturnValue('Jest probation import') };
    service.importProbation.mockResolvedValue({ created: 1, updated: 0, failed: 0, skipped: 0, rows: [] });

    await expect(subject.importProbation(
      user,
      file,
      '127.0.0.1',
      request as never,
    )).resolves.toEqual(expect.objectContaining({ created: 1 }));

    expect(service.importProbation).toHaveBeenCalledWith(user, file, {
      userId: user.id,
      ipAddress: '127.0.0.1',
      userAgent: 'Jest probation import',
    });
  });

  it('uses the standard download response for a probation export', async () => {
    const { controller: subject, service } = createController();
    const dto = {
      format: 'CSV' as const,
      fields: ['employeeNo'],
      query: { view: 'all' as const },
    };
    const response = { setHeader: jest.fn() };
    service.exportProbation.mockResolvedValue({
      contentType: 'text/csv; charset=utf-8',
      filename: '试用管理导出_2026-09-17.csv',
      buffer: Buffer.from('employeeNo'),
    });

    const result = await subject.exportProbation(user, dto as never, response as never);

    expect(service.exportProbation).toHaveBeenCalledWith(user, dto);
    expect(response.setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(response.setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      expect.stringContaining("filename*=UTF-8''"),
    );
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('uses the probation template response headers and preserves the service payload', async () => {
    const { controller: subject, service } = createController();
    const response = { setHeader: jest.fn() };
    service.getProbationImportTemplate.mockResolvedValue({
      contentType: 'text/csv; charset=utf-8',
      filename: '试用管理导入模板.csv',
      buffer: Buffer.from('template'),
    });

    const result = await subject.probationImportTemplate(
      { format: 'CSV' } as never,
      response as never,
    );

    expect(service.getProbationImportTemplate).toHaveBeenCalledWith('CSV');
    expect(response.setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(response.setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      expect.stringContaining('probation-import-template.csv'),
    );
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('delegates the probation query and workflow commands with their original arguments', () => {
    const { controller: subject, service } = createController();
    const query = { view: 'expiring' as const, page: 1, pageSize: 10 };
    const update = { plannedEndDate: '2026-10-01' };
    const evaluation = { evaluationType: 'REGULARIZATION' as const };
    const evaluationBatch = { probationIds: ['probation-1'] };
    const confirmationBatch = { probationIds: ['probation-1'], approverUserId: 'approver-1' };
    const confirmation = { evaluation: '建议转正', approverUserId: 'approver-1' };
    const confirmed = { confirmedDate: '2026-10-01' };
    const transferred = { approverUserId: 'approver-2' };

    subject.findProbation(user, query);
    subject.findProbationApprovers(user);
    subject.updateProbation(user, 'probation-1', update);
    subject.startProbationEvaluations(user, evaluationBatch);
    subject.startProbationEvaluation(user, 'probation-1', evaluation);
    subject.startProbationConfirmations(user, confirmationBatch);
    subject.submitProbationConfirmation(user, 'probation-1', confirmation);
    subject.confirmProbation(user, 'probation-1', confirmed);
    subject.approveProbation(user, 'probation-1');
    subject.remindProbationApproval(user, 'probation-1');
    subject.transferProbationApproval(user, 'probation-1', transferred);
    subject.returnProbationToEvaluation(user, 'probation-1');

    expect(service.findProbation).toHaveBeenCalledWith(user, query);
    expect(service.findProbationApprovers).toHaveBeenCalledWith(user);
    expect(service.updateProbation).toHaveBeenCalledWith(user, 'probation-1', update);
    expect(service.startProbationEvaluations).toHaveBeenCalledWith(user, evaluationBatch);
    expect(service.startProbationEvaluation).toHaveBeenCalledWith(user, 'probation-1', evaluation);
    expect(service.startProbationConfirmations).toHaveBeenCalledWith(user, confirmationBatch);
    expect(service.submitProbationConfirmation).toHaveBeenCalledWith(user, 'probation-1', confirmation);
    expect(service.confirmProbation).toHaveBeenCalledWith(user, 'probation-1', confirmed);
    expect(service.approveProbation).toHaveBeenCalledWith(user, 'probation-1');
    expect(service.remindProbationApproval).toHaveBeenCalledWith(user, 'probation-1');
    expect(service.transferProbationApproval).toHaveBeenCalledWith(user, 'probation-1', transferred);
    expect(service.returnProbationToEvaluation).toHaveBeenCalledWith(user, 'probation-1');
  });
});
