import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeRosterPage } from './EmployeeRosterPage';

const useEmployeeRosterList = vi.fn();
vi.mock('../../features/analytics/api', () => ({
  useEmployeeRosterList: (query: unknown) => useEmployeeRosterList(query),
}));

const row = {
  id: 'employee-1', name: '虚构员工', workEmail: 'fictional@example.invalid', employeeNo: 'FAKE-001',
  gender: 'FEMALE', birthDate: null, age: 0, highestEducation: '本科', graduationSchoolName: null,
  graduationDate: null, major: null, mobile: null, documentNumber: null, personalEmail: null,
  nativePlace: null, householdAddress: null, householdType: null, ethnicity: null, maritalStatus: null,
  politicalStatus: null, partyLeagueJoinDate: null, workStartDate: null, emergencyContactName: null,
  emergencyContactRelationship: null, emergencyContactMobile: null, entryDate: null,
  assignmentStartDate: null, assignmentEndDate: null, departmentName: null, jobTitleName: null,
  positionName: null, jobLevel: null, managerName: null, managerEmail: null, personnelCategory: null,
  serviceYears: 0, workYears: null, workplaceName: null, employmentRelationship: 'INTERNAL_EMPLOYEE', employmentStatus: 'REGULAR',
  hasProbation: false, probationStartDate: null, probationPlannedEndDate: null, probationMonths: null,
  confirmedDate: null, lastWorkingDate: null, organizationFullName: null, level1OrganizationName: null,
  level2OrganizationName: null, level3OrganizationName: null, agreementType: null, fullTimeCompany: null,
  contractTermType: 'FIXED', contractEffectiveDate: null, contractEndDate: null, contractMonths: null,
  actualTerminationDate: null,
} as const;

function renderPage(entry = '/analytics/roster') {
  return render(<MemoryRouter initialEntries={[entry]}><EmployeeRosterPage /></MemoryRouter>);
}

const expectedHeaders = [
  '姓名', '邮箱', '工号', '性别', '出生日期', '年龄', '最高学历', '毕业学校名称', '毕业时间', '专业', '手机',
  '证件号码', '个人邮箱', '籍贯', '户籍所在地', '户口类别', '民族', '婚姻状况', '政治面貌', '入党/团日期',
  '参加工作日期', '紧急联系人', '与本人关系', '紧急联系人电话', '入职日期', '开始日期', '结束日期',
  '部门', '职务', '职位', '职级', '直线经理', '直线经理邮箱', '人员类别', '累计司龄（年）', '累计工龄（年）', '工作地点',
  '雇佣关系', '人员状态', '是否有试用期', '试用开始日期', '预计试用结束日期', '试用期（月）', '转正日期', '最后工作日',
  '组织全称', '一级组织', '二级组织', '三级组织', '合同类型', '全日制公司', '合同期限类型', '合同生效日期', '合同终止日期',
  '合同期限（月）', '实际终止时间',
];

describe('EmployeeRosterPage', () => {
  beforeEach(() => {
    cleanup();
    useEmployeeRosterList.mockReset();
    useEmployeeRosterList.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });

  it('renders exactly the 56 business columns in contract order', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim())).toEqual(expectedHeaders);
  });

  it('maps values, preserves work email, and displays null as -- without hiding zero or false', () => {
    renderPage();
    expect(screen.getByText('fictional@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('内部员工')).toBeInTheDocument();
    expect(screen.getByText('正式')).toBeInTheDocument();
    expect(screen.getByText('否')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('0')).toHaveLength(2);
    expect(within(screen.getByRole('table')).getAllByText('--').length).toBeGreaterThan(10);
  });

  it('passes URL filters and pagination to the isolated roster query', () => {
    renderPage('/analytics/roster?keyword=FAKE&organizationId=org-1&page=3&pageSize=20');
    expect(useEmployeeRosterList).toHaveBeenLastCalledWith({
      keyword: 'FAKE', organizationId: 'org-1', page: 3, pageSize: 20,
    });
  });

  it('renders an error retry and the current-employees empty state', () => {
    const refetch = vi.fn();
    useEmployeeRosterList.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('网络错误'), refetch });
    renderPage();
    expect(screen.getByText('员工名册加载失败')).toBeInTheDocument();
    screen.getByRole('button', { name: /重\s*试/ }).click();
    expect(refetch).toHaveBeenCalledTimes(1);

    cleanup();
    useEmployeeRosterList.mockReturnValue({ data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }, isLoading: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('暂无当前在职员工')).toBeInTheDocument();
  });
});
