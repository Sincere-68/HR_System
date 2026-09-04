import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeListPage } from './EmployeeListPage';

const useEmployees = vi.fn();
const useOrganizations = vi.fn();
const useRegularEmployees = vi.fn();
const usePersonnelLaborWorkers = vi.fn();
const usePersonnelResigned = vi.fn();
const useInterns = vi.fn();

vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => ({
    user: { permissions: ['employee.read', 'employee.create'] },
  }),
}));

vi.mock('../../features/employees/api', () => ({
  useEmployees: (query: unknown) => useEmployees(query),
  useOrganizations: () => useOrganizations(),
  useRegularEmployees: (query: unknown) => useRegularEmployees(query),
  usePersonnelLaborWorkers: (query: unknown) => usePersonnelLaborWorkers(query),
  usePersonnelResigned: (query: unknown) => usePersonnelResigned(query),
  downloadEmployeeExport: vi.fn(),
}));

vi.mock('../../features/employment/api', () => ({
  useInterns: (query: unknown) => useInterns(query),
}));

const employees = [
  {
    id: 'employee-1',
    employeeNo: 'DEMO-1001',
    name: '虚构员工甲',
    mobile: '13800001001',
    idCardNo: '110101199203181021',
    organizationId: 'org-1',
    organizationName: '产品研发部',
    employmentStatus: 'REGULAR' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    entryDate: '2026-01-01',
    positionName: null,
    gender: null,
    personnelPosition: 'FRONT_OFFICE' as const,
    jobLevel: null,
    employeeLevel: 'STAFF' as const,
    workplaceName: null,
    workEmail: 'fictional.employee@example.invalid',
    personalEmail: 'fictional.personal@example.invalid',
    personnelCategory: 'NON_TALENT_PROGRAM' as const,
    personnelSource: null,
    fullTimeCompany: null,
    employmentRelationship: null,
    workArrangement: null,
    managerName: '虚构经理甲',
    managerEmail: 'manager@example.invalid',
    totalWorkYears: null,
    totalServiceYears: 0.65,
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '110101199203181021',
    documentExpiryDate: null,
    birthDate: null,
    age: null,
    ethnicity: null,
    maritalStatus: null,
    politicalStatus: null,
    nativePlace: null,
    nativePlaceRegionCode: null,
    householdType: null,
    householdRegionCode: null,
    householdAddress: null,
    residentialRegionCode: null,
    residentialAddress: null,
    emergencyContactName: null,
    emergencyContactRelationship: null,
    emergencyContactMobile: null,
    bankName: null,
    bankBranchName: null,
    bankAccountNumber: null,
    graduationSchoolName: null,
    institutionType: null,
    highestEducation: null,
    graduationDate: null,
    major: null,
  },
];

const regularEmployees = [{
  employeeId: 'regular-1',
  canViewEmployeeDetail: true,
  name: '虚构正式员工',
  employeeNo: 'REGULAR-001',
  entryDate: '2026-01-01',
  departmentName: '虚构正式部门',
  positionName: '虚构正式职位',
  jobLevel: 'S2' as const,
  gender: 'FEMALE' as const,
  workEmail: 'formal.employee@example.invalid',
  workArrangement: 'CONTRACT_EMPLOYMENT' as const,
  managerName: '虚构行政经理',
  resumeInfo: null,
  interviewEvaluation: null,
  bankName: 'ICBC' as const,
  bankAccountNumber: '6222000000000000001',
  bankBranchName: '虚构支行',
  fullTimeCompany: '虚构全日制公司',
}];

const interns = [{
  id: 'intern-1',
  employeeId: 'intern-employee-1',
  employeeName: '虚构实习生',
  workEmail: 'intern.employee@example.invalid',
  internshipOrganizationName: null,
  departmentName: '虚构实习部门',
  positionName: '虚构实习职位',
  startDate: '2026-08-01',
  approvalStatus: null,
  managerName: null,
  bankName: null,
  bankAccountNumber: null,
  bankBranchName: null,
  canViewEmployeeDetail: true,
}];

const laborWorkers = [{
  name: '虚构劳务人员',
  workEmail: 'labor.employee@example.invalid',
  employeeNo: 'LABOR-001',
  entryDate: '2026-08-01',
  departmentName: '虚构劳务部门',
  jobTitleName: '虚构劳务职务',
  positionName: '虚构劳务职位',
  workArrangement: 'LABOR_EMPLOYMENT' as const,
  managerName: '虚构劳务经理',
  employeeId: 'labor-employee-1',
  canViewEmployeeDetail: true,
}];

const resignedEmployees = [{
  id: 'resigned-1',
  employeeNo: 'RESIGNED-001',
  name: '虚构离职员工',
  departmentName: '虚构离职部门',
  gender: 'MALE' as const,
  entryDate: '2020-01-01',
  previousPositionName: '虚构离职前职位',
  terminationReason: '虚构离职原因',
  movementType: null,
  lastWorkingDate: '2026-08-30',
  lastWorkingDateBasis: 'ACTUAL' as const,
  fullTimeCompany: '虚构全日制公司',
  documentNumber: 'FAKE-RESIGNED-DOCUMENT',
  mobile: '13900001001',
}];

function queryResult<T>(data: T[]) {
  return {
    data: { data, meta: { page: 1, pageSize: 10, total: data.length, totalPages: 1 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current search">{location.search}</output>;
}

function renderPage(initialEntry = '/personnel/employees', showLocation = false) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <EmployeeListPage />
      {showLocation ? <LocationProbe /> : null}
    </MemoryRouter>,
  );
}

const allBusinessHeadings = [
  '工号', '姓名', '部门', '入职日期', '职位', '性别', '人员定位', '职级', '员工层级',
  '工作地点', '企业邮箱', '个人邮箱', '手机号码', '人员类别', '人员来源', '人员状态',
  '全日制公司', '雇佣关系', '用工形式', '直线经理', '直线经理邮箱', '累计工龄（年）',
  '累计司龄（年）', '证件类型', '证件号码', '证件截止日期', '出生日期', '年龄', '民族',
  '婚姻状况', '政治面貌', '籍贯地区', '籍贯详细说明', '户口类别', '户籍所在地地区', '户籍详细地址',
  '联系地址地区', '联系详细地址', '紧急联系人',
  '与本人关系', '紧急联系人电话', '银行', '开户行支行', '银行账号', '毕业学校名称',
  '院校类型', '最高学历', '毕业时间', '专业',
];

function currentTable() {
  return screen.getAllByRole('table').find((table) => table.closest('.employee-table'))!;
}

function getHeadings() {
  return within(currentTable()).getAllByRole('columnheader')
    .map((heading) => heading.textContent?.trim() ?? '')
    .filter(Boolean);
}

describe('EmployeeListPage', () => {
  beforeEach(() => {
    useEmployees.mockReset();
    useOrganizations.mockReset();
    useRegularEmployees.mockReset();
    usePersonnelLaborWorkers.mockReset();
    usePersonnelResigned.mockReset();
    useInterns.mockReset();
    useEmployees.mockReturnValue(queryResult(employees));
    useRegularEmployees.mockReturnValue(queryResult(regularEmployees));
    useInterns.mockReturnValue(queryResult(interns));
    usePersonnelLaborWorkers.mockReturnValue(queryResult(laborWorkers));
    usePersonnelResigned.mockReturnValue(queryResult(resignedEmployees));
    useOrganizations.mockReturnValue({
      data: [{ id: 'org-1', code: 'PRODUCT', name: '产品研发部', parentId: null }],
      isLoading: false,
    });
  });

  afterEach(cleanup);

  it('renders newly confirmed document types with their Chinese labels', () => {
    useEmployees.mockReturnValue(queryResult([{ ...employees[0], documentType: 'SINGAPORE_EP' as const }]));

    renderPage();

    expect(screen.getByText('新加坡亚籍（EP）')).toBeInTheDocument();
  });

  it('keeps the existing all-personnel business column order and view link', () => {
    useEmployees.mockReturnValue(queryResult([{
      ...employees[0],
      nativePlaceRegionCode: '310115',
      householdRegionCode: '110105',
      residentialRegionCode: '440305',
    }]));
    renderPage();

    expect(getHeadings()).toEqual([...allBusinessHeadings, '操作']);
    expect(screen.getByText('上海市 / 市辖区 / 浦东新区')).toBeInTheDocument();
    expect(screen.getByText('北京市 / 市辖区 / 朝阳区')).toBeInTheDocument();
    expect(screen.getByText('广东省 / 深圳市 / 南山区')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '虚构员工甲' })).toHaveAttribute(
      'href',
      '/personnel/employees/employee-1',
    );
    expect(screen.getByText('fictional.employee@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('fictional.personal@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('manager@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('前台')).toBeInTheDocument();
    expect(screen.getByText('员工级')).toBeInTheDocument();
    expect(screen.queryByText('FRONT_OFFICE')).not.toBeInTheDocument();
    expect(screen.queryByText('STAFF')).not.toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it('opens a field-selectable export dialog for the selected personnel', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /导出/ }));
    expect(screen.getByText('导出人员数据')).toBeInTheDocument();
    expect(screen.getByText('当前未勾选人员，将导出当前筛选条件下的全部人员。')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '工号' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '专业' })).toBeChecked();
  });

  it('renders five clickable personnel cards and switches URL view state', () => {
    renderPage('/personnel/employees?status=REGULAR&page=3&pageSize=20', true);

    expect(screen.getByRole('button', { name: /全部在职/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /正式人员/ }));

    expect(screen.getByLabelText('current search')).toHaveTextContent('?pageSize=20&view=regular&page=1');
    expect(screen.getByRole('button', { name: /正式人员/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders exact regular-personnel columns, fields, and unavailable placeholders', () => {
    renderPage('/personnel/employees?view=regular');

    expect(getHeadings()).toEqual([
      '姓名', '工号', '入职日期', '部门', '职位', '职级', '性别', '企业邮箱', '用工形式',
      '直线经理', '简历信息', '面试评价', '银行', '银行账号', '开户行支行', '全日制公司', '操作',
    ]);
    expect(screen.getByText('虚构正式员工')).toBeInTheDocument();
    expect(screen.getByText('正式人员')).toBeInTheDocument();
    expect(screen.getByText('合同用工')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute(
      'href',
      '/personnel/employees/regular-1',
    );
    expect(useRegularEmployees).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it('reuses intern management fields and query contract', () => {
    renderPage('/personnel/employees?view=intern&keyword=实习&page=2&pageSize=20');

    expect(getHeadings()).toEqual([
      '姓名', '邮箱', '实习机构', '实习部门', '实习职位', '实习开始日期',
      '审批状态', '直线经理', '银行', '银行账号', '开户行支行', '操作',
    ]);
    expect(screen.getByText('虚构实习生')).toBeInTheDocument();
    expect(useInterns).toHaveBeenLastCalledWith({
      keyword: '实习',
      startDateFrom: undefined,
      startDateTo: undefined,
      page: 2,
      pageSize: 20,
    });
  });

  it('renders exact personnel labor-worker columns without workplace', () => {
    renderPage('/personnel/employees?view=labor');

    expect(getHeadings()).toEqual([
      '姓名', '电子邮箱', '工号', '入职日期', '部门', '职务', '职位', '用工形式', '直线经理', '操作',
    ]);
    expect(screen.getByText('虚构劳务人员')).toBeInTheDocument();
    expect(screen.getByText('虚构劳务职位')).toBeInTheDocument();
    expect(screen.queryByText('工作地点')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute(
      'href',
      '/personnel/employees/labor-employee-1',
    );
  });

  it('renders exact completed-resignation columns and fixed movement placeholder', () => {
    renderPage('/personnel/employees?view=resigned');

    expect(getHeadings()).toEqual([
      '工号', '姓名', '部门', '性别', '入职日期', '离职前职位', '离职原因', '异动类型',
      '最后工作日', '全日制公司', '证件号码', '手机号码',
    ]);
    expect(screen.getByText('虚构离职员工')).toBeInTheDocument();
    expect(screen.getByText('虚构离职原因')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /查看|暂无详情/ })).not.toBeInTheDocument();
  });

  it('searches the personnel population by name and filters by employment relationship', () => {
    renderPage('/personnel/employees?view=all&page=2&pageSize=20');

    fireEvent.change(screen.getByRole('searchbox', { name: '按姓名搜索' }), { target: { value: '虚构员工' } });
    fireEvent.keyDown(screen.getByRole('searchbox', { name: '按姓名搜索' }), { key: 'Enter' });

    expect(useEmployees).toHaveBeenLastCalledWith(expect.objectContaining({
      name: '虚构员工', page: 1, pageSize: 20,
    }));

    fireEvent.click(screen.getAllByText('雇佣关系')[0]!);
    fireEvent.click(screen.getByText('内部员工'));

    expect(useEmployees).toHaveBeenLastCalledWith(expect.objectContaining({
      name: '虚构员工', employmentRelationship: 'INTERNAL_EMPLOYEE', page: 1, pageSize: 20,
    }));
  });

  it('clears selected all-personnel rows from the toolbar action', () => {
    renderPage();

    expect(screen.getByText('已选择 0 人')).toBeInTheDocument();
    const row = screen.getByText('虚构员工甲').closest('tr');
    fireEvent.click(within(row!).getByRole('checkbox'));
    expect(screen.getByText('已选择 1 人')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清空已选' }));
    expect(screen.getByText('已选择 0 人')).toBeInTheDocument();
  });

  it('applies URL-backed all-personnel department and status filters', () => {
    renderPage('/personnel/employees?status=REGULAR&page=2&pageSize=20');

    expect(useEmployees).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'REGULAR', page: 2, pageSize: 20,
    }));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: '筛选部门' }));
    fireEvent.click(within(screen.getByRole('tree')).getByText('产品研发部'));

    expect(useEmployees).toHaveBeenLastCalledWith(expect.objectContaining({
      organizationId: 'org-1', status: 'REGULAR', page: 1, pageSize: 20,
    }));
  });
});
