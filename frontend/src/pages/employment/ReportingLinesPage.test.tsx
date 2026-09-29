import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../lib/api';
import { buildReportingLinesHierarchy, ReportingLinesPage } from './ReportingLinesPage';

const useOrganizations = vi.fn();

vi.mock('../../features/employees/api', () => ({
  useOrganizations: () => useOrganizations(),
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

const managerA = {
  id: 'manager-a',
  employeeNo: 'F-001',
  name: '同名经理',
  organizationId: 'org-a',
  organizationName: '虚构部门',
  positionName: '经理',
  canViewEmployeeDetail: true,
  rootReason: null,
};

const managerB = {
  ...managerA,
  id: 'manager-b',
  employeeNo: 'F-002',
  canViewEmployeeDetail: true,
};

const employee = {
  id: 'employee-1',
  employeeNo: 'F-003',
  name: '虚构员工',
  organizationId: 'org-a',
  organizationName: '虚构部门',
  positionName: '员工',
  canViewEmployeeDetail: true,
  rootReason: null,
};

const root = {
  id: 'root-1',
  employeeNo: 'F-004',
  name: '无上级根',
  organizationId: 'org-a',
  organizationName: '虚构部门',
  positionName: '负责人',
  canViewEmployeeDetail: true,
  rootReason: 'NO_CURRENT_MANAGER' as const,
};

const relationship = {
  id: 'relationship-1',
  employeeId: employee.id,
  managerEmployeeId: managerB.id,
  employee,
  manager: managerB,
  relationshipType: 'ADMINISTRATIVE',
  isPrimary: true,
  startDate: '2026-01-01',
  endDate: null,
  status: 'ACTIVE',
};

const listResponse = {
  data: [relationship],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

const graphResponse = {
  data: listResponse.data,
  meta: { page: 1, pageSize: 0, total: 1, totalPages: 1 },
  graph: {
    nodes: [managerB, employee, root],
    edges: [
      {
        relationshipId: relationship.id,
        sourceEmployeeId: relationship.employeeId,
        targetManagerEmployeeId: relationship.managerEmployeeId,
        isPrimary: relationship.isPrimary,
        relationshipType: relationship.relationshipType,
        startDate: relationship.startDate,
        endDate: relationship.endDate,
        status: relationship.status,
      },
    ],
    warnings: [],
  },
};

function renderPage(entry = '/employment/reporting-lines') {
  return render(<MemoryRouter initialEntries={[entry]}><ReportingLinesPage /></MemoryRouter>);
}

function mockApiResponses() {
  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    if (path.includes('view=graph')) return graphResponse;
    return listResponse;
  });
}

describe('ReportingLinesPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    useOrganizations.mockReset();
    useOrganizations.mockReturnValue({
      data: [{ id: 'org-a', name: '虚构部门', parentId: null }],
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockApiResponses();
  });

  it('loads explicit relationship IDs instead of inferring a manager from employee names', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole('tree')).toBeInTheDocument());

    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
      expect.stringContaining('/employment/reporting-relationships?'),
    );
    expect(vi.mocked(apiRequest).mock.calls[0]?.[0]).toContain('view=graph');
    expect(screen.getByRole('link', { name: '同名经理' })).toHaveAttribute(
      'href',
      '/personnel/employees/manager-b',
    );
    expect(screen.getByRole('link', { name: '虚构员工' })).toHaveAttribute(
      'href',
      '/personnel/employees/employee-1',
    );
    expect(screen.getByRole('link', { name: '无上级根' })).toHaveAttribute(
      'href',
      '/personnel/employees/root-1',
    );
    expect(screen.getByText('关系 ID：relationship-1')).toBeInTheDocument();
    expect(screen.queryByText('manager-a')).not.toBeInTheDocument();
  });

  it('does not use a paginated list response as the graph data source', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByRole('tree')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '汇报关系图' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: '汇报关系图' })).toBeInTheDocument());
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path.includes('view=graph'))).toBe(true);
    expect(vi.mocked(apiRequest).mock.calls.find(([path]) => path.includes('view=graph'))?.[0])
      .not.toContain('page=');
    expect(screen.getByText('全部人员')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '同名经理' })).toHaveAttribute(
      'href',
      '/personnel/employees/manager-b',
    );
    expect(screen.getByRole('link', { name: '虚构员工' })).toHaveAttribute(
      'href',
      '/personnel/employees/employee-1',
    );
  });

  it('renders an employee with no manager as an authorized root without inventing a manager', () => {
    const hierarchy = buildReportingLinesHierarchy({
      nodes: [root],
      edges: [],
    });

    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0]?.employee.id).toBe('root-1');
    expect(hierarchy[0]?.children).toEqual([]);
  });

  it('crops an out-of-scope manager without exposing its identity', () => {
    const hierarchy = buildReportingLinesHierarchy({
      nodes: [employee],
      edges: [{
        relationshipId: 'relationship-out-of-scope',
        sourceEmployeeId: employee.id,
        targetManagerEmployeeId: 'out-of-scope-manager',
        isPrimary: true,
        relationshipType: 'ADMINISTRATIVE',
        startDate: null,
        endDate: null,
        status: 'ACTIVE',
      }],
    });

    expect(hierarchy.map((node) => node.employee.id)).toEqual(['employee-1']);
    expect(hierarchy[0]?.children).toEqual([]);
    expect(JSON.stringify(hierarchy)).not.toContain('out-of-scope-manager');
  });

  it('does not create a detail link when the snapshot denies current detail access', async () => {
    const deniedEmployee = { ...employee, canViewEmployeeDetail: false };
    const hierarchy = buildReportingLinesHierarchy({ nodes: [deniedEmployee], edges: [] });
    expect(hierarchy[0]?.employee.canViewEmployeeDetail).toBe(false);
    vi.mocked(apiRequest).mockResolvedValueOnce({
      data: [],
      meta: { page: 1, pageSize: 0, total: 0, totalPages: 0 },
      graph: { nodes: [deniedEmployee], edges: [], warnings: [] },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('虚构员工')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: '虚构员工' })).not.toBeInTheDocument();
    expect(screen.getByText('虚构员工')).toHaveAttribute('aria-label', '虚构员工（暂无详情）');
  });

  it('keeps safe roots and stops self-loops and cycles', () => {
    const nodes = [
      { ...managerA, id: 'employee-a', name: '员工A' },
      { ...managerB, id: 'employee-b', name: '员工B' },
      { ...root, id: 'safe-root', name: '安全根' },
    ];
    const hierarchy = buildReportingLinesHierarchy({
      nodes,
      edges: [
        {
          relationshipId: 'self-loop',
          sourceEmployeeId: 'employee-a',
          targetManagerEmployeeId: 'employee-a',
          isPrimary: true,
          relationshipType: 'ADMINISTRATIVE',
          startDate: null,
          endDate: null,
          status: 'ACTIVE',
        },
        {
          relationshipId: 'cycle-a-b',
          sourceEmployeeId: 'employee-a',
          targetManagerEmployeeId: 'employee-b',
          isPrimary: true,
          relationshipType: 'ADMINISTRATIVE',
          startDate: null,
          endDate: null,
          status: 'ACTIVE',
        },
        {
          relationshipId: 'cycle-b-a',
          sourceEmployeeId: 'employee-b',
          targetManagerEmployeeId: 'employee-a',
          isPrimary: true,
          relationshipType: 'ADMINISTRATIVE',
          startDate: null,
          endDate: null,
          status: 'ACTIVE',
        },
      ],
    });

    expect(hierarchy.some((node) => node.employee.id === 'safe-root')).toBe(true);
    expect(JSON.stringify(hierarchy)).not.toContain('self-loop');
    expect(JSON.stringify(hierarchy)).not.toContain('cycle-a-b');
    expect(JSON.stringify(hierarchy)).not.toContain('cycle-b-a');
  });
});
