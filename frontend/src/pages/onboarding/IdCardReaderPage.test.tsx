import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdCardReaderPage } from './IdCardReaderPage';

const useIdCardReader = vi.fn();

vi.mock('../../features/onboarding/api', () => ({
  useIdCardReader: (query: unknown) => useIdCardReader(query),
}));

const documentNumber = '110101199203181021';
const record = {
  id: 'identity-1',
  name: '虚构员工甲',
  gender: 'FEMALE',
  ethnicity: '虚构民族',
  birthDate: '1990-02-03',
  householdAddress: null,
  documentType: 'NATIONAL_ID' as const,
  documentNumber: documentNumber,
  issuingAuthority: '虚构市公安局',
  issueDate: '2010-02-03',
  expiryDate: '2030-02-03',
  lastWorkingDate: '2026-07-31',
  previousOrganizationName: '虚构产品中心',
  terminationType: '虚构协商离职',
  terminationReason: null,
  photo: null,
  recordedBy: null,
  recordedAt: '2026-08-20T12:34:56.000Z',
};

function renderPage(initialEntry = '/onboarding/id-card-reader') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <IdCardReaderPage />
    </MemoryRouter>,
  );
}

describe('IdCardReaderPage', () => {
  beforeEach(() => {
    useIdCardReader.mockReset();
    useIdCardReader.mockReturnValue({
      data: { data: [record], meta: { page: 2, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it('renders exactly 18 columns in the required order and preserves complete API values', () => {
    renderPage('/onboarding/id-card-reader?page=2&pageSize=20');
    const table = screen.getByRole('table');
    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((heading) => heading.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '性别', '民族', '出生日期', '户籍所在地', '证件类型', '证件号码', '签发机关',
      '证件开始日期', '证件截止日期', '最后工作日', '离职前部门', '离职类型', '离职原因',
      '照片', '录入人', '录入时间', '操作',
    ]);
    expect(screen.getByText('虚构员工甲')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('身份证')).toBeInTheDocument();
    expect(screen.getByText(documentNumber)).toBeInTheDocument();
    expect(screen.queryByText('1101012345671021')).not.toBeInTheDocument();
    expect(screen.getByText('1990-02-03')).toBeInTheDocument();
    expect(screen.getByText('2010-02-03')).toBeInTheDocument();
    expect(screen.getByText('2030-02-03')).toBeInTheDocument();
    expect(screen.getByText('2026-07-31')).toBeInTheDocument();
    expect(screen.getByText('2026-08-20T12:34:56.000Z')).toBeInTheDocument();
    expect(within(table).getAllByText('--').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('button', { name: '暂无操作' })).toBeDisabled();
  });

  it('passes URL pagination and renders the requested empty state', () => {
    renderPage('/onboarding/id-card-reader?page=2&pageSize=20');
    expect(useIdCardReader).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });

    cleanup();
    useIdCardReader.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage('/onboarding/id-card-reader?page=bad&pageSize=0');
    expect(useIdCardReader).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
    expect(screen.getByText('暂无身份证读取记录')).toBeInTheDocument();
  });

  it('passes URL pagination values to the reader query', () => {
    renderPage('/onboarding/id-card-reader?page=2&pageSize=20');
    expect(useIdCardReader).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
  });
});
