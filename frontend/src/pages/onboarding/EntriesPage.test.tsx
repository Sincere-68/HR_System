import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntriesPage } from './EntriesPage';

const useOnboardingEntries = vi.fn();

vi.mock('../../features/onboarding/api', () => ({
  useOnboardingEntries: (query: unknown) => useOnboardingEntries(query),
}));

const entry = {
  id: 'case-1',
  name: '虚构员工甲',
  gender: 'FEMALE',
  plannedOrganizationName: '虚构待入职中心',
  plannedEntryDate: '2026-09-03',
  entryType: null,
  plannedWorkplaceName: '虚构园区',
  positionName: '虚构岗位',
  jobLevel: null,
  managerName: '虚构经理',
  onboardingStatus: 'IN_PROGRESS',
  preparationStatus: null,
  informationCollectionStatus: null,
  materialStatus: null,
  employmentRelationship: null,
  fullTimeCompany: '虚构全日制公司',
  contractType: 'LABOR_SERVICE_CONTRACT' as const,
  effectiveDate: '2026-09-01',
  terminationDate: null,
  dataSource: '虚构招聘渠道',
  currentApproverName: null,
};

function renderPage(initialEntry = '/onboarding/entries') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <EntriesPage />
    </MemoryRouter>,
  );
}

describe('EntriesPage', () => {
  beforeEach(() => {
    useOnboardingEntries.mockReset();
    useOnboardingEntries.mockReturnValue({
      data: { data: [entry], meta: { page: 2, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it('renders the 21 required columns in order and maps values', () => {
    renderPage('/onboarding/entries?page=2&pageSize=20');
    const table = screen.getByRole('table');
    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((heading) => heading.textContent?.trim()).filter(Boolean)).toHaveLength(21);
    expect(columnHeaders.map((heading) => heading.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '性别', '待入职部门', '计划入职日期', '入职类型', '计划入职地点', '职位', '职级', '直线经理',
      '入职状态', '入职准备状态', '信息采集状态', '入职材料状态', '雇佣关系', '全日制公司', '合同类型',
      '生效日期', '终止日期', '数据来源', '当前审批人', '操作',
    ]);
    expect(screen.getByText('虚构员工甲')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('劳务合同')).toBeInTheDocument();
    expect(screen.getByText('虚构招聘渠道')).toBeInTheDocument();
    expect(within(table).getAllByText('--').length).toBeGreaterThanOrEqual(7);
    expect(screen.getByRole('button', { name: '暂无操作' })).toBeDisabled();
  });

  it('renders only the requested table page without heading tabs', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: '入职管理' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '入职管理功能' })).not.toBeInTheDocument();
    expect(screen.queryByText('全部待入职')).not.toBeInTheDocument();
    expect(screen.queryByText('今日待入职')).not.toBeInTheDocument();
    expect(screen.queryByText('已取消入职')).not.toBeInTheDocument();
    expect(screen.queryByText('已入职')).not.toBeInTheDocument();
  });

  it('passes URL pagination and falls back for invalid values', () => {
    renderPage('/onboarding/entries?page=bad&pageSize=0');
    expect(useOnboardingEntries).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it('renders the empty state', () => {
    useOnboardingEntries.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('暂无入职记录')).toBeInTheDocument();
  });
});
