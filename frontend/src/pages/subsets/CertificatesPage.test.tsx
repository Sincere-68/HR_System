import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CertificatesPage } from './CertificatesPage';

const useCertificateList = vi.fn();

vi.mock('../../features/employee-subsets/api', () => ({
  useCertificateList: (query: unknown) => useCertificateList(query),
}));

const record = {
  id: 'certificate-1', employeeId: 'employee-1', employeeName: '虚构员工甲', employeeNo: 'DEMO-1001',
  workEmail: 'fictional.certificate@example.invalid', departmentName: '虚构研发部',
  certificateName: '虚构项目管理证书', certificateNo: null, issuingAuthority: '虚构认证机构',
  issueDate: '2025-05-20', expiryDate: null, approvalStatus: null, canViewEmployeeDetail: true,
};

function renderPage(entry = '/subsets/certificates') {
  return render(<MemoryRouter initialEntries={[entry]}><CertificatesPage /></MemoryRouter>);
}

describe('CertificatesPage', () => {
  beforeEach(() => {
    useCertificateList.mockReset();
    useCertificateList.mockReturnValue({
      data: { data: [record], meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });
  afterEach(() => cleanup());

  it('renders the exact 11-column order, work email, values, and nullable fields', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '工号', '部门', '证书名称', '证书编号', '发证机构', '获得时间', '有效期至', '审批状态', '操作',
    ]);
    expect(screen.getByText('fictional.certificate@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('虚构项目管理证书')).toBeInTheDocument();
    expect(screen.queryByText('FAKE-CERT-001')).not.toBeInTheDocument();
    expect(screen.getByText('2025-05-20')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(3);
    expect(screen.getByRole('link', { name: '查看' })).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('renders the certificate number exactly as returned by the API', () => {
    useCertificateList.mockReturnValue({
      data: { data: [{ ...record, certificateNo: 'FAKE-CERT-001', expiryDate: '2028-05-19' }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('FAKE-CERT-001')).toBeInTheDocument();
    expect(screen.getByText('2028-05-19')).toBeInTheDocument();
  });

  it('passes URL query and writes pagination back', () => {
    renderPage('/subsets/certificates?keyword=DEMO&organizationId=org-a&page=2&pageSize=20');
    expect(useCertificateList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-a', page: 2, pageSize: 20,
    }));
    fireEvent.click(screen.getByTitle('Next Page'));
    expect(useCertificateList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 20 }));
  });

  it('renders unavailable detail and the empty state', () => {
    useCertificateList.mockReturnValue({
      data: { data: [{ ...record, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    const view = renderPage();
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();

    view.unmount();
    useCertificateList.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的证书执照')).toBeInTheDocument();
  });
});
