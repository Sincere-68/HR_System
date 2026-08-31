import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguagesPage } from './LanguagesPage';

const useLanguageList = vi.fn();

vi.mock('../../features/employee-subsets/api', () => ({
  useLanguageList: (query: unknown) => useLanguageList(query),
}));

const record = {
  id: 'language-1', employeeId: 'employee-1', employeeName: '虚构员工甲', employeeNo: 'DEMO-1001',
  workEmail: 'fictional.language@example.invalid', departmentName: '虚构研发部', language: '虚构语言甲',
  nativeLanguage: null, proficiencyLevel: null, writingLevel: '良好', readingLevel: null,
  speakingLevel: '熟练', approvalStatus: null, canViewEmployeeDetail: true,
};

function renderPage(entry = '/subsets/languages') {
  return render(<MemoryRouter initialEntries={[entry]}><LanguagesPage /></MemoryRouter>);
}

describe('LanguagesPage', () => {
  beforeEach(() => {
    useLanguageList.mockReset();
    useLanguageList.mockReturnValue({
      data: { data: [record], meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });
  afterEach(() => cleanup());

  it('renders the exact 12-column order without inferring whether the language is native', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '工号', '部门', '语言', '是否母语', '掌握程度', '书写能力', '阅读能力', '口语能力', '审批状态', '操作',
    ]);
    expect(screen.getByText('fictional.language@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('虚构语言甲')).toBeInTheDocument();
    expect(screen.getByText('良好')).toBeInTheDocument();
    expect(screen.getByText('熟练')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(4);
    expect(screen.queryByText('是')).not.toBeInTheDocument();
    expect(screen.queryByText('否')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看' })).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('passes URL query and writes pagination back', () => {
    renderPage('/subsets/languages?keyword=DEMO&organizationId=org-a&page=2&pageSize=20');
    expect(useLanguageList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-a', page: 2, pageSize: 20,
    }));
    fireEvent.click(screen.getByTitle('Next Page'));
    expect(useLanguageList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 20 }));
  });

  it('renders future boolean native-language values, unavailable detail, and the empty state', () => {
    useLanguageList.mockReturnValue({
      data: { data: [{ ...record, nativeLanguage: true, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    const view = renderPage();
    expect(screen.getByText('是')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();

    view.unmount();
    useLanguageList.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的语言能力')).toBeInTheDocument();
  });
});
