import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeForm } from './EmployeeForm';

const employee = {
  id: 'employee-1',
  employeeNo: 'DEMO-1001',
  name: '林知夏',
  mobile: '138****1001',
  idCardNo: '110101********1021',
  organizationId: 'org-1',
  organizationName: '产品研发部',
  employmentStatus: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const organizations = [{ id: 'org-1', code: 'PRODUCT', name: '产品研发部', parentId: null }];

describe('EmployeeForm', () => {
  it('does not put masked sensitive values into editable inputs', async () => {
    render(
      <EmployeeForm
        formId="test-form"
        employee={employee}
        organizations={organizations}
        canReadSensitive={false}
        onSubmit={vi.fn()}
      />,
    );
    expect(await screen.findByDisplayValue('DEMO-1001')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('138****1001')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('110101********1021')).not.toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('留空则不修改')).toHaveLength(2);
  });
});
