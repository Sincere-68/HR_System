import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetirementManagementPage } from './RetirementManagementPage';

const useRetirements = vi.fn();
const useOrganizations = vi.fn();
vi.mock('../../features/employment/api', () => ({
  useRetirements: (query: unknown) => useRetirements(query),
}));
vi.mock('../../features/employees/api', () => ({
  useOrganizations: () => useOrganizations(),
}));

const row = {
  id: 'retirement-1',
  employeeId: 'employee-1',
  employeeName: '虚构员工',
  employeeNo: 'F-001',
  gender: 'FEMALE',
  age: 55,
  birthDate: '1970-08-26',
  plannedRetirementDate: '2030-08-24',
  departmentName: '虚构部门',
  jobTitleName: '虚构职务',
  canViewEmployeeDetail: true,
};

function renderPage(entry = '/employment/retirement') {
  return render(<MemoryRouter initialEntries={[entry]}><RetirementManagementPage /></MemoryRouter>);
}

describe('RetirementManagementPage', () => {
  beforeEach(() => {
    useRetirements.mockReset();
    useOrganizations.mockReset();
    useRetirements.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useOrganizations.mockReturnValue({
      data: [{ id: 'org-a', name: '虚构部门' }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the exact nine-column order, renders real fields, and links employee detail', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')
      .map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '性别', '年龄', '出生日期', '预计退休日期', '部门', '职务', '操作',
    ]);
    expect(screen.getByText('虚构员工')).toBeInTheDocument();
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('1970-08-26')).toBeInTheDocument();
    expect(screen.getByText('2030-08-24')).toBeInTheDocument();
    expect(screen.getByText('虚构部门')).toBeInTheDocument();
    expect(screen.getByText('虚构职务')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看/ }).closest('a'))
      .toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('renders missing sourced fields and unavailable assignment values as placeholders', () => {
    useRetirements.mockReturnValue({
      data: {
        data: [{
          ...row,
          gender: null,
          age: null,
          birthDate: null,
          plannedRetirementDate: null,
          departmentName: null,
          jobTitleName: null,
        }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const view = renderPage();
    expect(within(view.container.querySelector('.retirement-table') as HTMLElement)
      .getAllByText('--')).toHaveLength(6);
  });

  it('preserves URL filters and pagination in the API query', () => {
    renderPage('/employment/retirement?keyword=F-002&status=APPROVED&plannedRetirementDateFrom=2030-01-01&plannedRetirementDateTo=2030-12-31&departmentId=org-a&page=3&pageSize=20');
    expect(useRetirements).toHaveBeenLastCalledWith({
      keyword: 'F-002',
      status: 'APPROVED',
      plannedRetirementDateFrom: '2030-01-01',
      plannedRetirementDateTo: '2030-12-31',
      departmentId: 'org-a',
      page: 3,
      pageSize: 20,
    });
  });
});
