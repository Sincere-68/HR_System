import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractsPage } from './ContractsPage';

const useContracts = vi.fn();
vi.mock('../../features/contracts/api', () => ({
  useContracts: (query: unknown) => useContracts(query),
}));

const row = {
  id: 'agreement-1',
  employeeNo: 'F-001',
  employeeName: '虚构员工',
  departmentName: '虚构部门',
  entryDate: '2025-12-01',
  fullTimeCompany: '虚构全日制公司',
  agreementType: 'NON_FULL_TIME_EMPLOYMENT_CONTRACT' as const,
  termType: 'FIXED' as const,
  effectiveDate: '2026-01-01',
  endDate: '2027-01-01',
  latestElectronicSignatureStatus: null,
  latestElectronicAgreementAttachment: null,
  electronicSignatureRecords: null,
  contractRemark: null,
};

function renderPage(entry = '/contracts') {
  return render(<MemoryRouter initialEntries={[entry]}><ContractsPage /></MemoryRouter>);
}

describe('ContractsPage', () => {
  beforeEach(() => {
    cleanup();
    useContracts.mockReset();
    useContracts.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the exact 14-column order and renders labels, placeholders, and disabled action', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '工号', '姓名', '部门', '入职日期', '全日制公司', '合同类型', '期限类型', '生效日期',
      '终止日期', '最新电子协议签署状态', '最新电子协议附件', '电子协议签署记录', '合同备注', '操作',
    ]);
    expect(screen.getByText('非全日制用工合同')).toBeInTheDocument();
    expect(screen.getByText('固定期限')).toBeInTheDocument();
    expect(screen.getByText('虚构全日制公司')).toBeInTheDocument();
    expect(within(table).getAllByText('--')).toHaveLength(4);
    expect(screen.getByRole('button', { name: '暂无操作' })).toBeDisabled();
  });

  it('preserves URL keyword, organization, and pagination in the API query', () => {
    renderPage('/contracts?keyword=F-002&organizationId=org-child&page=3&pageSize=20');

    expect(useContracts).toHaveBeenLastCalledWith({
      keyword: 'F-002',
      organizationId: 'org-child',
      page: 3,
      pageSize: 20,
    });
  });

  it('renders an empty page and retries after an error', () => {
    const refetch = vi.fn();
    useContracts.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('网络错误'), refetch });
    renderPage();

    expect(screen.getByText('合同协议加载失败')).toBeInTheDocument();
    expect(screen.getByText('网络错误')).toBeInTheDocument();
    screen.getByRole('button', { name: /重\s*试/ }).click();
    expect(refetch).toHaveBeenCalledTimes(1);

    cleanup();
    useContracts.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的合同协议')).toBeInTheDocument();
  });
});
