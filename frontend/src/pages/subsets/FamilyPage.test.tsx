import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyPage } from './FamilyPage';

const useFamilyList = vi.fn();

vi.mock('../../features/employee-subsets/api', () => ({
  useFamilyList: (query: unknown) => useFamilyList(query),
}));

const record = {
  id: 'family-1', employeeId: 'employee-1', employeeName: '虚构员工甲', employeeNo: 'DEMO-1001',
  workEmail: 'fictional.family@example.invalid', departmentName: '虚构研发部', memberName: '虚构家属乙',
  relationshipName: '母亲', gender: 'FEMALE', mobile: '13912345678', approvalStatus: null,
  canViewEmployeeDetail: true,
};

function renderPage(entry = '/subsets/family') {
  return render(<MemoryRouter initialEntries={[entry]}><FamilyPage /></MemoryRouter>);
}

describe('FamilyPage', () => {
  beforeEach(() => {
    useFamilyList.mockReset();
    useFamilyList.mockReturnValue({
      data: { data: [record], meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });
  afterEach(() => cleanup());

  it('renders the exact 10-column order and complete family values', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')
      .map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '工号', '部门', '成员姓名', '与本人关系名称', '性别', '手机号码', '审批状态', '操作',
    ]);
    expect(screen.getByText('fictional.family@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('虚构家属乙')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('13912345678')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看' })).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('passes URL query and writes pagination back', () => {
    renderPage('/subsets/family?keyword=DEMO&organizationId=org-a&page=2&pageSize=20');
    expect(useFamilyList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-a', page: 2, pageSize: 20,
    }));
    fireEvent.click(screen.getByTitle('Next Page'));
    expect(useFamilyList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 20 }));
  });

  it('renders unavailable detail, null gender and mobile, and the empty state', () => {
    useFamilyList.mockReturnValue({
      data: { data: [{ ...record, gender: null, mobile: null, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    const view = renderPage();
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();

    view.unmount();
    useFamilyList.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的家庭成员')).toBeInTheDocument();
  });
});
