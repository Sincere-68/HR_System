import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntroductionPage } from './IntroductionPage';

const useEmployeeIntroduction = vi.fn();

vi.mock('../../features/onboarding/api', () => ({
  useEmployeeIntroduction: (query: unknown) => useEmployeeIntroduction(query),
}));

const introduction = {
  id: 'introduction-1',
  name: '虚构员工辛',
  gender: 'FEMALE',
  organizationName: '虚构客户中心',
  positionName: null,
  entryDate: '2026-08-11',
  introductionStatus: 'IN_PROGRESS',
};

function renderPage(initialEntry = '/onboarding/introduction') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <IntroductionPage />
    </MemoryRouter>,
  );
}

describe('IntroductionPage', () => {
  beforeEach(() => {
    useEmployeeIntroduction.mockReset();
    useEmployeeIntroduction.mockReturnValue({
      data: { data: [introduction], meta: { page: 2, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it('renders exactly seven introduction columns in the required order with mapped and nullable values', () => {
    renderPage('/onboarding/introduction?page=2&pageSize=20');
    const table = screen.getByRole('table');
    const columnHeaders = within(table).getAllByRole('columnheader');

    expect(columnHeaders.map((heading) => heading.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '性别', '部门', '职位', '入职日期', '入职介绍信息状态', '操作',
    ]);
    expect(screen.getByText('虚构员工辛')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('虚构客户中心')).toBeInTheDocument();
    expect(screen.getByText('2026-08-11')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(within(table).getByText('--')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂无操作' })).toBeDisabled();
  });

  it('passes URL pagination to the introduction query and falls back for invalid values', () => {
    renderPage('/onboarding/introduction?page=2&pageSize=20');
    expect(useEmployeeIntroduction).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });

    cleanup();
    renderPage('/onboarding/introduction?page=bad&pageSize=0');
    expect(useEmployeeIntroduction).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it('renders the requested title and empty state without extra controls', () => {
    useEmployeeIntroduction.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole('heading', { name: '新员工入职介绍' })).toBeInTheDocument();
    expect(screen.getByText('暂无新员工入职介绍记录')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
