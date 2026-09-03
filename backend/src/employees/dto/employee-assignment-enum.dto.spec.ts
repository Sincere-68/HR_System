import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';
import { UpdateEmployeeDto } from './update-employee.dto';

describe('Employee assignment fixed-enum DTO validation', () => {
  it('rejects unsupported personnel position and employee level codes on creation', async () => {
    const dto = plainToInstance(CreateEmployeeDto, {
      personnelPosition: 'OPERATIONS',
      employeeLevel: 'VP',
    });

    const errors = await validate(dto, { skipMissingProperties: true });
    const constrainedProperties = errors
      .filter((error) => error.constraints)
      .map((error) => error.property);

    expect(constrainedProperties).toEqual(expect.arrayContaining([
      'personnelPosition',
      'employeeLevel',
    ]));
  });

  it('accepts confirmed job-level codes and rejects legacy or unknown values on creation', async () => {
    const validDto = plainToInstance(CreateEmployeeDto, {
      jobLevel: 'S1',
    });
    const boundaryDto = plainToInstance(CreateEmployeeDto, {
      jobLevel: 'E7',
    });
    const invalidDto = plainToInstance(CreateEmployeeDto, {
      jobLevel: 'P2',
    });
    const unknownDto = plainToInstance(CreateEmployeeDto, {
      jobLevel: 'LEVEL-1',
    });

    expect(await validate(validDto, { skipMissingProperties: true })).toHaveLength(0);
    expect(await validate(boundaryDto, { skipMissingProperties: true })).toHaveLength(0);
    expect(await validate(invalidDto, { skipMissingProperties: true })).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'jobLevel' }),
    ]));
    expect(await validate(unknownDto, { skipMissingProperties: true })).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'jobLevel' }),
    ]));
  });

  it('accepts a newly confirmed document type and rejects an unknown one', async () => {
    const validDto = plainToInstance(CreateEmployeeDto, { documentType: 'SINGAPORE_EP' });
    const invalidDto = plainToInstance(UpdateEmployeeDto, { documentType: 'UNCONFIRMED_DOCUMENT' });

    expect(await validate(validDto, { skipMissingProperties: true })).toHaveLength(0);
    expect(await validate(invalidDto)).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'documentType' }),
    ]));
  });

  it('accepts a complete initial-employment payload on update', async () => {
    const dto = plainToInstance(UpdateEmployeeDto, {
      initialEmployment: {
        organizationId: 'organization-target-1',
        entryDate: '2026-09-02',
        employmentRelationship: 'INTERNAL_EMPLOYEE',
        workArrangement: 'CONTRACT_EMPLOYMENT',
        employmentStatus: 'REGULAR',
      },
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts confirmed fixed codes and a target organization ID on update', async () => {
    const validDto = plainToInstance(UpdateEmployeeDto, {
      organizationId: 'organization-target-1',
      personnelPosition: 'MIDDLE_OFFICE',
      employeeLevel: 'MANAGER',
    });
    const invalidDto = plainToInstance(UpdateEmployeeDto, {
      personnelPosition: 'OPERATIONS',
      employeeLevel: 'VP',
    });

    expect(await validate(validDto)).toHaveLength(0);
    const errors = await validate(invalidDto);
    const constrainedProperties = errors
      .filter((error) => error.constraints)
      .map((error) => error.property);

    expect(constrainedProperties).toEqual(expect.arrayContaining([
      'personnelPosition',
      'employeeLevel',
    ]));
  });
});
